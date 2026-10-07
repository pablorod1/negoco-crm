import type { Client, InStatement, Row } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type { CatalogAlias, CatalogRate, TenantRate } from "./match";
import type {
  CommissionRule,
  CommissionRuleInput,
  IngestFile,
  IngestStatus,
  RateDiscount,
  RateVersion,
  StoredRatePrice,
  Territory,
  VersionStatus,
} from "./types";

type QueryClient = Pick<Client, "execute" | "batch">;

/** Proveedor con el que se marcan en `comercializadora_rates` las tarifas del catálogo. */
export const CATALOG_PROVIDER = "negoco_catalog";

const str = (value: unknown) => (value === null || value === undefined ? null : String(value));
const num = (value: unknown) =>
  value === null || value === undefined ? null : Number(value);

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ── Comercializadoras y tarifas del tenant ──────────────────────────────────

export async function getComercializadora(client: QueryClient, id: string) {
  const { rows } = await client.execute({
    sql: "SELECT id, name FROM comercializadoras WHERE id = ? LIMIT 1",
    args: [id],
  });
  return rows[0] ? { id: String(rows[0].id), name: String(rows[0].name) } : null;
}

export async function listTenantRates(
  client: QueryClient,
  comercializadoraId: string,
): Promise<TenantRate[]> {
  const { rows } = await client.execute({
    sql: `SELECT id, name, comercializadora_id, catalog_rate_id, enabled
      FROM comercializadora_rates WHERE comercializadora_id = ?`,
    args: [comercializadoraId],
  });
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    comercializadoraId: String(row.comercializadora_id),
    catalogRateId: str(row.catalog_rate_id),
    enabled: Number(row.enabled ?? 1) === 1,
  }));
}

export function insertTenantRateStatement(rate: {
  id: string;
  name: string;
  comercializadoraId: string;
  catalogRateId: string | null;
  accessTariff: string;
}): InStatement {
  return {
    sql: `INSERT INTO comercializadora_rates
      (id, name, comercializadora_id, type, provider, descripcion, catalog_rate_id,
       enabled, created_at, updated_at)
      VALUES (?, ?, ?, 'fijo', ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [
      rate.id,
      rate.name,
      rate.comercializadoraId,
      CATALOG_PROVIDER,
      rate.accessTariff,
      rate.catalogRateId,
    ],
  };
}

export async function setTenantRateEnabled(
  client: QueryClient,
  { rateId, comercializadoraId, enabled }: { rateId: string; comercializadoraId: string; enabled: boolean },
) {
  await client.execute({
    sql: `UPDATE comercializadora_rates SET enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND comercializadora_id = ?`,
    args: [enabled ? 1 : 0, rateId, comercializadoraId],
  });
}

// ── Versiones y precios ──────────────────────────────────────────────────────

function toVersion(row: Row): RateVersion {
  return {
    id: String(row.id),
    comercializadoraId: String(row.comercializadora_id),
    status: String(row.status) as VersionStatus,
    validFrom: str(row.valid_from),
    validTo: str(row.valid_to),
    source: String(row.source) as RateVersion["source"],
    ingestId: str(row.ingest_id),
    basedOnVersionId: str(row.based_on_version_id),
    notes: str(row.notes),
    createdBy: str(row.created_by),
    approvedBy: str(row.approved_by),
    approvedAt: str(row.approved_at),
    createdAt: String(row.created_at),
  };
}

export async function listVersions(
  client: QueryClient,
  comercializadoraId: string,
): Promise<RateVersion[]> {
  const { rows } = await client.execute({
    sql: `SELECT * FROM comercializadora_rate_versions
      WHERE comercializadora_id = ? ORDER BY created_at DESC LIMIT 50`,
    args: [comercializadoraId],
  });
  return rows.map(toVersion);
}

function dayBefore(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/**
 * Versión vigente en una fecha. Si hay una programada que ya ha empezado, la
 * activa en ese momento y cierra la anterior: no hace falta ninguna tarea
 * programada para que una versión entre en vigor.
 */
export async function getActiveVersion(
  client: QueryClient,
  comercializadoraId: string,
  today: string,
): Promise<RateVersion | null> {
  const due = await client.execute({
    sql: `SELECT * FROM comercializadora_rate_versions
      WHERE comercializadora_id = ? AND status = 'scheduled' AND valid_from <= ?
      ORDER BY valid_from DESC, created_at DESC`,
    args: [comercializadoraId, today],
  });

  if (due.rows.length > 0) {
    const next = toVersion(due.rows[0]);
    const statements: InStatement[] = [
      {
        sql: `UPDATE comercializadora_rate_versions
          SET status = 'superseded', valid_to = COALESCE(valid_to, ?), updated_at = CURRENT_TIMESTAMP
          WHERE comercializadora_id = ? AND status = 'active'`,
        args: [dayBefore(next.validFrom!), comercializadoraId],
      },
      // Programadas más antiguas que ya no llegarán a estar activas.
      ...due.rows.slice(1).map((row) => ({
        sql: `UPDATE comercializadora_rate_versions
          SET status = 'superseded', valid_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [dayBefore(next.validFrom!), String(row.id)],
      })),
      {
        sql: `UPDATE comercializadora_rate_versions
          SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [next.id],
      },
    ];
    await client.batch(statements, "write");
  }

  const { rows } = await client.execute({
    sql: `SELECT * FROM comercializadora_rate_versions
      WHERE comercializadora_id = ? AND status = 'active' LIMIT 1`,
    args: [comercializadoraId],
  });
  return rows[0] ? toVersion(rows[0]) : null;
}

function toStoredPrice(row: Row): StoredRatePrice {
  const power =
    row.power_p1 !== null && row.power_p2 !== null
      ? { P1: Number(row.power_p1), P2: Number(row.power_p2) }
      : null;
  const energy =
    row.energy_p1 !== null && row.energy_p2 !== null && row.energy_p3 !== null
      ? { P1: Number(row.energy_p1), P2: Number(row.energy_p2), P3: Number(row.energy_p3) }
      : null;
  return {
    id: String(row.id),
    versionId: String(row.version_id),
    rateId: String(row.rate_id),
    rateName: String(row.rate_name ?? ""),
    catalogRateId: str(row.catalog_rate_id),
    accessTariff: String(row.access_tariff),
    pricing: String(row.pricing) as StoredRatePrice["pricing"],
    level: str(row.level),
    territory: String(row.territory) as Territory,
    channel: str(row.channel) as StoredRatePrice["channel"],
    clientSegment: str(row.client_segment),
    minPowerKw: num(row.min_power_kw),
    maxPowerKw: num(row.max_power_kw),
    minAnnualKwh: num(row.min_annual_kwh),
    maxAnnualKwh: num(row.max_annual_kwh),
    supplyStartFrom: str(row.supply_start_from),
    supplyStartTo: str(row.supply_start_to),
    termMonths: num(row.term_months),
    powerMode: String(row.power_mode) as StoredRatePrice["powerMode"],
    powerMarginPerKwYear: num(row.power_margin_per_kw_year),
    power,
    energy,
    includesAncillaryServices: Number(row.includes_ancillary_services) === 1,
    feeEnergyMinPerMwh: num(row.fee_energy_min_per_mwh),
    feeEnergyMaxPerMwh: num(row.fee_energy_max_per_mwh),
    feePowerAllowed: Number(row.fee_power_allowed) === 1,
    discounts: parseJson<RateDiscount[]>(row.discounts, []),
    sourceExcerpt: str(row.source_excerpt),
    sourceLocation: str(row.source_location),
  };
}

export async function getVersionPrices(
  client: QueryClient,
  versionId: string,
): Promise<StoredRatePrice[]> {
  const { rows } = await client.execute({
    sql: `SELECT p.*, r.name AS rate_name, r.catalog_rate_id
      FROM comercializadora_rate_prices p
      JOIN comercializadora_rates r ON r.id = p.rate_id
      WHERE p.version_id = ?
      ORDER BY r.name, p.level, p.min_power_kw, p.min_annual_kwh`,
    args: [versionId],
  });
  return rows.map(toStoredPrice);
}

export interface NewPriceRow
  extends Omit<StoredRatePrice, "id" | "versionId" | "rateName" | "catalogRateId"> {
  sourceValues: Record<string, unknown> | null;
}

export function insertPriceStatement(versionId: string, row: NewPriceRow): InStatement {
  return {
    sql: `INSERT INTO comercializadora_rate_prices (
        id, version_id, rate_id, access_tariff, pricing, level, territory, channel,
        client_segment, min_power_kw, max_power_kw, min_annual_kwh, max_annual_kwh,
        supply_start_from, supply_start_to, term_months, conditions, power_mode,
        power_margin_per_kw_year, power_p1, power_p2, energy_p1, energy_p2, energy_p3,
        includes_ancillary_services, fee_energy_min_per_mwh, fee_energy_max_per_mwh,
        fee_power_allowed, discounts, source_excerpt, source_location, source_values)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      randomUUID(),
      versionId,
      row.rateId,
      row.accessTariff,
      row.pricing,
      row.level,
      row.territory,
      row.channel,
      row.clientSegment,
      row.minPowerKw,
      row.maxPowerKw,
      row.minAnnualKwh,
      row.maxAnnualKwh,
      row.supplyStartFrom,
      row.supplyStartTo,
      row.termMonths,
      row.powerMode,
      row.powerMarginPerKwYear,
      row.power?.P1 ?? null,
      row.power?.P2 ?? null,
      row.energy?.P1 ?? null,
      row.energy?.P2 ?? null,
      row.energy?.P3 ?? null,
      row.includesAncillaryServices ? 1 : 0,
      row.feeEnergyMinPerMwh,
      row.feeEnergyMaxPerMwh,
      row.feePowerAllowed ? 1 : 0,
      row.discounts.length ? JSON.stringify(row.discounts) : null,
      row.sourceExcerpt,
      row.sourceLocation,
      row.sourceValues ? JSON.stringify(row.sourceValues) : null,
    ],
  };
}

/**
 * Sentencias para guardar una versión nueva. Si entra en vigor hoy o antes,
 * cierra la activa (valid_to = día anterior) en la misma transacción; si no,
 * queda programada y la activa getActiveVersion cuando llegue la fecha.
 */
export function insertVersionStatements({
  version,
  today,
}: {
  version: {
    id: string;
    comercializadoraId: string;
    validFrom: string;
    validTo: string | null;
    source: RateVersion["source"];
    ingestId: string | null;
    basedOnVersionId: string | null;
    notes: string | null;
    userId: string;
  };
  today: string;
}): { statements: InStatement[]; status: VersionStatus } {
  const status: VersionStatus = version.validFrom <= today ? "active" : "scheduled";
  const statements: InStatement[] = [];
  if (status === "active") {
    statements.push({
      sql: `UPDATE comercializadora_rate_versions
        SET status = 'superseded', valid_to = COALESCE(valid_to, ?), updated_at = CURRENT_TIMESTAMP
        WHERE comercializadora_id = ? AND status = 'active'`,
      args: [dayBefore(version.validFrom), version.comercializadoraId],
    });
  }
  statements.push({
    sql: `INSERT INTO comercializadora_rate_versions
      (id, comercializadora_id, status, valid_from, valid_to, source, ingest_id,
       based_on_version_id, notes, created_by, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [
      version.id,
      version.comercializadoraId,
      status,
      version.validFrom,
      version.validTo,
      version.source,
      version.ingestId,
      version.basedOnVersionId,
      version.notes,
      version.userId,
      version.userId,
    ],
  });
  return { statements, status };
}

/** Descarta una versión programada que aún no ha entrado en vigor. */
export async function discardScheduledVersion(
  client: QueryClient,
  { versionId, comercializadoraId }: { versionId: string; comercializadoraId: string },
): Promise<boolean> {
  const result = await client.execute({
    sql: `UPDATE comercializadora_rate_versions
      SET status = 'discarded', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND comercializadora_id = ? AND status = 'scheduled'`,
    args: [versionId, comercializadoraId],
  });
  return result.rowsAffected === 1;
}

/** Última aprobación por comercializadora, para el aviso de tarifas sin actualizar. */
export async function listLastApprovals(client: QueryClient) {
  const { rows } = await client.execute(`SELECT c.id, c.name, c.active,
      (SELECT MAX(v.approved_at) FROM comercializadora_rate_versions v
        WHERE v.comercializadora_id = c.id AND v.status IN ('active', 'scheduled', 'superseded')) AS last_approved_at,
      (SELECT COUNT(*) FROM comercializadora_rate_versions v
        WHERE v.comercializadora_id = c.id AND v.status = 'active') AS has_active
    FROM comercializadoras c`);
  return rows.map((row) => ({
    comercializadoraId: String(row.id),
    name: String(row.name),
    active: Number(row.active ?? 0) === 1 || String(row.active) === "true",
    lastApprovedAt: str(row.last_approved_at),
    hasActiveVersion: Number(row.has_active) > 0,
  }));
}

// ── Ingestas ────────────────────────────────────────────────────────────────

export interface IngestRecord {
  id: string;
  channel: "upload" | "email" | "api";
  status: IngestStatus;
  comercializadoraId: string | null;
  files: IngestFile[];
  bodyText: string | null;
  emailFrom: string | null;
  emailSubject: string | null;
  classification: unknown;
  extraction: unknown;
  validation: unknown;
  versionId: string | null;
  models: string[];
  costUsd: number | null;
  error: string | null;
  receivedAt: string;
  processedAt: string | null;
  decidedAt: string | null;
  createdBy: string | null;
  decidedBy: string | null;
}

function toIngest(row: Row): IngestRecord {
  return {
    id: String(row.id),
    channel: String(row.channel) as IngestRecord["channel"],
    status: String(row.status) as IngestStatus,
    comercializadoraId: str(row.comercializadora_id),
    files: parseJson<IngestFile[]>(row.files, []),
    bodyText: str(row.body_text),
    emailFrom: str(row.email_from),
    emailSubject: str(row.email_subject),
    classification: parseJson(row.classification, null),
    extraction: parseJson(row.extraction, null),
    validation: parseJson(row.validation, null),
    versionId: str(row.version_id),
    models: parseJson<string[]>(row.models, []),
    costUsd: num(row.cost_usd),
    error: str(row.error),
    receivedAt: String(row.received_at),
    processedAt: str(row.processed_at),
    decidedAt: str(row.decided_at),
    createdBy: str(row.created_by),
    decidedBy: str(row.decided_by),
  };
}

export async function createIngest(
  client: QueryClient,
  ingest: {
    id?: string;
    channel: IngestRecord["channel"];
    comercializadoraId: string | null;
    files: IngestFile[];
    bodyText?: string | null;
    emailFrom?: string | null;
    emailSubject?: string | null;
    createdBy: string | null;
  },
): Promise<string> {
  const id = ingest.id ?? randomUUID();
  await client.execute({
    sql: `INSERT INTO rate_ingests
      (id, channel, status, comercializadora_id, files, body_text, email_from, email_subject, created_by)
      VALUES (?, ?, 'received', ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      ingest.channel,
      ingest.comercializadoraId,
      JSON.stringify(ingest.files),
      ingest.bodyText ?? null,
      ingest.emailFrom ?? null,
      ingest.emailSubject ?? null,
      ingest.createdBy,
    ],
  });
  return id;
}

export async function getIngest(client: QueryClient, id: string) {
  const { rows } = await client.execute({
    sql: "SELECT * FROM rate_ingests WHERE id = ? LIMIT 1",
    args: [id],
  });
  return rows[0] ? toIngest(rows[0]) : null;
}

export async function listIngests(
  client: QueryClient,
  { comercializadoraId, limit = 30 }: { comercializadoraId?: string | null; limit?: number },
) {
  const { rows } = await client.execute({
    sql: comercializadoraId
      ? `SELECT * FROM rate_ingests WHERE comercializadora_id = ? ORDER BY received_at DESC LIMIT ?`
      : `SELECT * FROM rate_ingests ORDER BY received_at DESC LIMIT ?`,
    args: comercializadoraId ? [comercializadoraId, limit] : [limit],
  });
  return rows.map(toIngest);
}

/** Pasa la ingesta a `processing` solo si nadie la está procesando ya. */
export async function claimIngest(client: QueryClient, id: string): Promise<boolean> {
  const result = await client.execute({
    sql: `UPDATE rate_ingests SET status = 'processing', error = NULL
      WHERE id = ? AND status IN ('received', 'failed', 'needs_review', 'ready', 'out_of_scope')`,
    args: [id],
  });
  return result.rowsAffected === 1;
}

export async function saveIngestResult(
  client: QueryClient,
  id: string,
  result: {
    status: IngestStatus;
    comercializadoraId?: string | null;
    classification?: unknown;
    extraction?: unknown;
    validation?: unknown;
    models?: string[];
    costUsd?: number | null;
    error?: string | null;
  },
) {
  await client.execute({
    sql: `UPDATE rate_ingests SET status = ?,
        comercializadora_id = COALESCE(?, comercializadora_id),
        classification = ?, extraction = ?, validation = ?, models = ?,
        cost_usd = ?, error = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    args: [
      result.status,
      result.comercializadoraId ?? null,
      result.classification === undefined ? null : JSON.stringify(result.classification),
      result.extraction === undefined ? null : JSON.stringify(result.extraction),
      result.validation === undefined ? null : JSON.stringify(result.validation),
      JSON.stringify(result.models ?? []),
      result.costUsd ?? null,
      result.error ?? null,
      id,
    ],
  });
}

export function decideIngestStatement(
  id: string,
  decision: { status: "approved" | "rejected"; userId: string; versionId: string | null },
): InStatement {
  return {
    sql: `UPDATE rate_ingests SET status = ?, version_id = ?, decided_at = CURRENT_TIMESTAMP,
        decided_by = ? WHERE id = ?`,
    args: [decision.status, decision.versionId, decision.userId, id],
  };
}

// ── Reglas de comisión ──────────────────────────────────────────────────────

export async function listCommissionRules(
  client: QueryClient,
  comercializadoraId: string,
): Promise<CommissionRule[]> {
  const { rows } = await client.execute({
    sql: `SELECT * FROM rate_commission_rules WHERE comercializadora_id = ?
      ORDER BY valid_from DESC, level, min_annual_kwh`,
    args: [comercializadoraId],
  });
  return rows.map((row) => ({
    id: String(row.id),
    comercializadoraId: String(row.comercializadora_id),
    rateId: str(row.rate_id),
    accessTariff: str(row.access_tariff),
    level: str(row.level),
    channel: str(row.channel) as CommissionRule["channel"],
    minAnnualKwh: num(row.min_annual_kwh),
    maxAnnualKwh: num(row.max_annual_kwh),
    ruleType: String(row.rule_type) as CommissionRule["ruleType"],
    feeBase: parseJson<{ feeBase?: string }>(row.conditions, {}).feeBase === "power" ? "power" : "energy",
    amount: Number(row.amount),
    validFrom: String(row.valid_from),
    validTo: str(row.valid_to),
  }));
}

/**
 * Las reglas nuevas sustituyen a las vigentes de la misma comercializadora
 * desde su fecha: las anteriores se cierran el día antes.
 */
export function replaceCommissionRulesStatements({
  comercializadoraId,
  rules,
  validFrom,
  ingestId,
  userId,
}: {
  comercializadoraId: string;
  rules: readonly CommissionRuleInput[];
  validFrom: string;
  ingestId: string | null;
  userId: string;
}): InStatement[] {
  if (rules.length === 0) return [];
  return [
    {
      sql: `UPDATE rate_commission_rules SET valid_to = ?, updated_at = CURRENT_TIMESTAMP
        WHERE comercializadora_id = ? AND valid_to IS NULL AND valid_from < ?`,
      args: [dayBefore(validFrom), comercializadoraId, validFrom],
    },
    ...rules.map((rule) => ({
      sql: `INSERT INTO rate_commission_rules
        (id, comercializadora_id, rate_id, access_tariff, level, channel, min_annual_kwh,
         max_annual_kwh, rule_type, amount, valid_from, conditions, ingest_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        comercializadoraId,
        rule.rateId,
        rule.accessTariff,
        rule.level,
        rule.channel,
        rule.minAnnualKwh,
        rule.maxAnnualKwh,
        rule.ruleType,
        rule.amount,
        validFrom,
        // La base del fee va en conditions: rule_type tiene un CHECK cerrado.
        rule.ruleType === "fee_share" && rule.feeBase === "power"
          ? JSON.stringify({ feeBase: "power" })
          : null,
        ingestId,
        userId,
      ],
    })),
  ];
}

// ── Catálogo (base de control) ──────────────────────────────────────────────

export async function listCatalog(
  control: Pick<Client, "execute">,
  supplierKey: string,
): Promise<{ catalog: CatalogRate[]; aliases: CatalogAlias[] }> {
  const [catalog, aliases] = await Promise.all([
    control.execute({
      sql: `SELECT * FROM rate_catalog WHERE supplier_key = ? ORDER BY product_name`,
      args: [supplierKey],
    }),
    control.execute({
      sql: `SELECT alias_key, catalog_rate_id FROM rate_catalog_aliases WHERE supplier_key = ?`,
      args: [supplierKey],
    }),
  ]);
  return {
    catalog: catalog.rows.map((row) => ({
      id: String(row.id),
      supplierKey: String(row.supplier_key),
      supplierName: String(row.supplier_name),
      productName: String(row.product_name),
      productKey: String(row.product_key),
      pricing: String(row.pricing),
      accessTariffs: String(row.access_tariffs),
      status: String(row.status) as CatalogRate["status"],
    })),
    aliases: aliases.rows.map((row) => ({
      aliasKey: String(row.alias_key),
      catalogRateId: String(row.catalog_rate_id),
    })),
  };
}

export function insertCatalogRateStatement(rate: {
  id: string;
  supplierKey: string;
  supplierName: string;
  productName: string;
  productKey: string;
  accessTariffs: string;
  createdBy: string;
}): InStatement {
  return {
    sql: `INSERT INTO rate_catalog
      (id, supplier_key, supplier_name, product_name, product_key, energy, pricing,
       access_tariffs, created_by)
      VALUES (?, ?, ?, ?, ?, 'electricity', 'fixed', ?, ?)
      ON CONFLICT (supplier_key, product_key) DO NOTHING`,
    args: [
      rate.id,
      rate.supplierKey,
      rate.supplierName,
      rate.productName,
      rate.productKey,
      rate.accessTariffs,
      rate.createdBy,
    ],
  };
}
