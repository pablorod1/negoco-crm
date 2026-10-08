import type { Client, InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { buildDiff, type DiffEntry, type ResolvedRow } from "./diff";
import { prepareDocument, type RateSource } from "./document";
import { extractRateDocument, type RateExtractionResult } from "./extract";
import { matchProducts, type RateMatch } from "./match";
import { normalizeName } from "./names";
import { ruleCoversRate } from "@/comparador/engine/commission";
import { powerToPerDay, toProposedCommissions } from "./normalize";
import {
  claimIngest,
  decideIngestStatement,
  getActiveVersion,
  getComercializadora,
  getVersionPrices,
  insertCatalogRateStatement,
  insertPriceStatement,
  insertTenantRateStatement,
  insertVersionStatements,
  listCatalog,
  listTenantRates,
  replaceCommissionRulesStatements,
  saveIngestResult,
  type IngestRecord,
} from "./repository";
import { readIngestFile } from "./storage";
import type { CommissionRuleInput, RateVersion, StoredRatePrice } from "./types";
import { isInScope, rowKey, type RateIssue } from "./validate";

type TenantClient = Pick<Client, "execute" | "batch">;

/** Fecha de hoy en España (YYYY-MM-DD): las vigencias de los anexos van en hora peninsular. */
export function todayInSpain(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export class RateIngestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "RateIngestError";
  }
}

/** Casa el nombre que trae el documento con una comercializadora del tenant. */
export async function findComercializadoraByName(
  client: TenantClient,
  name: string | null,
): Promise<{ id: string; name: string } | null> {
  const key = name ? normalizeName(name) : "";
  if (!key) return null;
  const { rows } = await client.execute("SELECT id, name FROM comercializadoras");
  const suppliers = rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    key: normalizeName(String(row.name)),
  }));
  const exact = suppliers.find((supplier) => supplier.key === key);
  if (exact) return exact;
  // «Quimera Infinita» en el anexo y «Quimera» en el CRM, o al revés. Un
  // nombre corto («VM») solo casa entero: «vm» está dentro de muchos nombres.
  if (key.length < 4) return null;
  const partial = suppliers.filter(
    (supplier) =>
      supplier.key.length >= 4 && (key.includes(supplier.key) || supplier.key.includes(key)),
  );
  return partial.length === 1 ? partial[0] : null;
}

/**
 * Procesa una ingesta: lee el documento, lo clasifica y extrae, y guarda el
 * resultado para revisarlo. No toca precios: eso solo pasa al aprobar.
 */
export async function processIngest({
  client,
  ingest,
  tenantSlug,
  userId,
  extract = extractRateDocument,
  readFile = readIngestFile,
}: {
  client: TenantClient;
  ingest: IngestRecord;
  tenantSlug: string;
  userId: string | null;
  extract?: typeof extractRateDocument;
  readFile?: typeof readIngestFile;
}): Promise<IngestRecord["status"]> {
  if (!(await claimIngest(client, ingest.id))) {
    throw new RateIngestError("La ingesta ya se está procesando o ya está decidida.", 409);
  }

  try {
    const file = ingest.files[0];
    const source: RateSource = file
      ? { kind: "file", name: file.name, mime: file.mime, data: await readFile(file) }
      : { kind: "text", text: ingest.bodyText ?? "", html: /<\w+[^>]*>/.test(ingest.bodyText ?? "") };
    const document = await prepareDocument(source);
    const supplier = ingest.comercializadoraId
      ? await getComercializadora(client, ingest.comercializadoraId)
      : null;

    const result = await extract({
      document,
      context: {
        tenantSlug,
        jobType: "rate_extraction",
        userId: userId ?? undefined,
        subjectId: ingest.id,
      },
      supplierName: supplier?.name ?? null,
    });

    let comercializadoraId = ingest.comercializadoraId;
    if (!comercializadoraId) {
      const detected = await findComercializadoraByName(
        client,
        result.status === "out_of_scope"
          ? result.classification.supplierName
          : (result.extraction.supplierName ?? result.classification?.supplierName ?? null),
      );
      comercializadoraId = detected?.id ?? null;
    }

    const status =
      result.status === "out_of_scope"
        ? "out_of_scope"
        : result.status === "ok" && comercializadoraId
          ? "ready"
          : "needs_review";

    await saveIngestResult(client, ingest.id, {
      status,
      comercializadoraId,
      classification: result.classification,
      extraction: result,
      validation: result.status === "out_of_scope" ? [] : result.issues,
      models: result.status === "out_of_scope" ? [] : result.attempts.map(({ model }) => model),
      costUsd: result.costUsd,
    });
    return status;
  } catch (error) {
    // Los errores propios ya explican qué hacer; uno de la IA o de la red
    // («No object generated…») no le dice nada a quien revisa.
    const explained =
      error instanceof Error && EXPLAINED_ERRORS.has(error.name) ? error.message.slice(0, 500) : null;
    if (!explained) console.error("[comparador] ingest failed", ingest.id, error);
    await saveIngestResult(client, ingest.id, {
      status: "failed",
      error:
        explained ??
        "No se ha podido leer el documento. Prueba a volver a leerlo; si sigue fallando, avisa a soporte.",
    });
    throw error;
  }
}

/** Errores con un mensaje pensado para quien revisa la ingesta. */
const EXPLAINED_ERRORS = new Set([
  "RateDocumentTooLargeError",
  "RateIngestError",
  "SheetRecipeUnavailableError",
  "UnsupportedDocumentError",
]);

type ExtractedResult = Extract<RateExtractionResult, { status: "ok" | "needs_review" }>;

/** Nombres de las tarifas a las que se aplica una regla, sin repetir, como «Oslo II» o «Clásico 1 precio (Alto)». */
function ratesCoveredBy(
  rule: Pick<CommissionRuleInput, "rateId" | "product" | "level">,
  rates: readonly { rateId: string; productName: string; level: string | null }[],
): string[] {
  const names = new Set<string>();
  for (const rate of rates) {
    if (ruleCoversRate(rule, rate)) names.add(rate.level ? `${rate.productName} (${rate.level})` : rate.productName);
  }
  return [...names].sort((left, right) => left.localeCompare(right, "es"));
}

export interface ProposedCommission extends CommissionRuleInput {
  productName: string | null;
  /**
   * Tarifas de la comercializadora a las que se aplicaría (vigentes o de este
   * documento), para ver en la revisión si casa bien. Vacío: no se aplica a
   * ninguna.
   */
  covers: string[];
}

export interface IngestReview {
  supplier: { id: string; name: string };
  activeVersion: RateVersion | null;
  validFrom: string | null;
  validTo: string | null;
  partialUpdate: boolean;
  skipped: string[];
  issues: RateIssue[];
  entries: DiffEntry[];
  /** Productos que no están en el catálogo: solo Negoco puede darlos de alta. */
  newProducts: string[];
  commissions: ProposedCommission[];
  /** Filas que el documento trae pero no entran en la v1 (indexadas, 3.0TD…). */
  outOfScope: { productName: string; accessTariff: string; pricing: string }[];
}

/** Días a partir de los cuales un anexo se marca como posiblemente desfasado. */
export const OLD_DOCUMENT_DAYS = 30;

/**
 * Un anexo de hace más de un mes probablemente ya no es el vigente: el de
 * APOLO de la carpeta de Beenergy era del 24 de julio.
 */
export function documentAgeIssue(validFrom: string | null, today: string): RateIssue | null {
  if (!validFrom || !/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) return null;
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${validFrom}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= OLD_DOCUMENT_DAYS) return null;
  return {
    severity: "warning",
    code: "old_document",
    message: `Los precios son del ${validFrom.split("-").reverse().join("/")}, hace ${days} días: comprueba que es el último anexo de la comercializadora.`,
  };
}

export interface ReviewDecisions {
  /** false: las comisiones del documento no se guardan (y sus incidencias no cuentan). */
  includeCommissions?: boolean;
  /** rowKey de las filas propuestas que no se guardan. */
  excludedRowKeys?: readonly string[];
  /** rowKey de las filas sin potencia que llevan la regulada («BOE»). */
  regulatedPowerRowKeys?: readonly string[];
  /**
   * Potencia indicada por el revisor (€/kW·año) para filas que no la traen:
   * Holaluz manda la potencia en otro PDF y no es la del BOE.
   */
  manualPower?: Readonly<Record<string, { p1: number; p2: number }>>;
  /**
   * El anexo solo actualiza parte de las tarifas: las que no trae se mantienen
   * en vez de darse de baja. Endesa manda un anexo por familia de producto
   * (Open, Residencial); sin esto, aprobar uno borraría el otro. Si no se
   * indica, vale lo que haya deducido la lectura.
   */
  partialUpdate?: boolean;
}

/**
 * Prepara la revisión de una ingesta frente a la versión activa de hoy. Se
 * calcula al pedirla, no al procesar: la versión activa puede haber cambiado.
 */
export async function buildReview({
  client,
  control,
  ingest,
  today,
  decisions = {},
}: {
  client: TenantClient;
  control: Pick<Client, "execute">;
  ingest: IngestRecord;
  today: string;
  decisions?: ReviewDecisions;
}): Promise<{
  review: IngestReview;
  resolved: ResolvedRow[];
  activePrices: StoredRatePrice[];
  versionRows: ReturnType<typeof buildDiff>["versionRows"];
} | null> {
  const result = ingest.extraction as RateExtractionResult | null;
  if (!result || result.status === "out_of_scope" || !ingest.comercializadoraId) return null;
  const extracted = result as ExtractedResult;

  const supplier = await getComercializadora(client, ingest.comercializadoraId);
  if (!supplier) return null;

  const [{ catalog, aliases }, tenantRates, activeVersion] = await Promise.all([
    listCatalog(control, normalizeName(supplier.name)),
    listTenantRates(client, supplier.id),
    getActiveVersion(client, supplier.id, today),
  ]);
  const activePrices = activeVersion ? await getVersionPrices(client, activeVersion.id) : [];

  const excluded = new Set(decisions.excludedRowKeys ?? []);
  const regulated = new Set(decisions.regulatedPowerRowKeys ?? []);
  const manual = decisions.manualPower ?? {};

  const inScope = extracted.proposed.filter(isInScope);
  const kept = inScope
    .filter((row) => !excluded.has(rowKey(row)))
    .map((row) => {
      if (row.powerStated) return row;
      const typed = manual[rowKey(row)];
      if (typed) {
        return {
          ...row,
          powerMode: "fixed" as const,
          power: { P1: powerToPerDay(typed.p1, "eur_kw_year"), P2: powerToPerDay(typed.p2, "eur_kw_year") },
          powerStated: true,
        };
      }
      return regulated.has(rowKey(row))
        ? { ...row, powerMode: "regulated" as const, power: null, powerStated: true }
        : row;
    });
  const matches = matchProducts(kept, { tenantRates, catalog, aliases });
  const resolved: ResolvedRow[] = kept.map((row) => ({
    ...row,
    match: matches.get(row.productKey)!,
  }));
  // Un documento sin precios 2.0TD (solo comisiones, como el de Nordy) no
  // puede retirar ninguna tarifa: siempre es parcial.
  const partialUpdate =
    inScope.length === 0 || (decisions.partialUpdate ?? extracted.extraction.partialUpdate);
  const diff = buildDiff(resolved, activePrices, { partialUpdate });

  const commissionMatches = matchProducts(
    toProposedCommissions(extracted.extraction)
      .filter((rule) => rule.productKey)
      .map((rule) => ({ productKey: rule.productKey!, productName: rule.productName! })),
    { tenantRates, catalog, aliases },
  );
  const coverable = [
    ...activePrices.map((price) => ({ rateId: price.rateId, productName: price.rateName, level: price.level })),
    ...resolved.map((row) => ({
      rateId: row.match.rateId ?? `new:${row.productKey}`,
      productName: row.productName,
      level: row.level,
    })),
  ];
  const commissions = toProposedCommissions(extracted.extraction).map((rule) => {
    const rateId = rule.productKey ? (commissionMatches.get(rule.productKey)?.rateId ?? null) : null;
    return {
      productName: rule.productName,
      rateId,
      product: rule.product,
      accessTariff: rule.accessTariff,
      level: rule.level,
      channel: rule.channel,
      minAnnualKwh: rule.minAnnualKwh,
      maxAnnualKwh: rule.maxAnnualKwh,
      minKw: rule.minKw,
      maxKw: rule.maxKw,
      ruleType: rule.ruleType,
      feeBase: rule.feeBase,
      amount: rule.amount,
      minAmount: rule.minAmount,
      covers: ratesCoveredBy({ rateId, product: rule.product, level: rule.level }, coverable),
    };
  });

  // Las incidencias de filas excluidas ya no cuentan; la potencia regulada
  // elegida por el revisor resuelve la que faltaba.
  const extractionIssues = extracted.issues.filter(
    (issue) =>
      !(issue.rowKey && excluded.has(issue.rowKey)) &&
      !(
        issue.code === "missing_power" &&
        issue.rowKey &&
        (regulated.has(issue.rowKey) || manual[issue.rowKey])
      ) &&
      !(issue.code === "no_rates" && commissions.length > 0) &&
      !(issue.code === "commission_not_in_source" && decisions.includeCommissions === false),
  );

  const newProducts = [
    ...new Set(
      [...matches.values()]
        .filter((match: RateMatch) => match.status === "new")
        .map(({ productName }) => productName),
    ),
  ];

  const oldDocument = documentAgeIssue(extracted.extraction.validFrom, today);

  return {
    review: {
      supplier,
      activeVersion,
      validFrom: extracted.extraction.validFrom,
      validTo: extracted.extraction.validTo,
      partialUpdate,
      skipped: extracted.extraction.skipped,
      // La comparación repite «no da la potencia» para las filas que la
      // lectura ya ha marcado: un aviso por fila basta.
      issues: [
        ...(oldDocument ? [oldDocument] : []),
        ...extractionIssues,
        ...diff.issues.filter(
          (issue) =>
            !(
              issue.code === "missing_power" &&
              extractionIssues.some(({ code, rowKey: key }) => code === "missing_power" && key === issue.rowKey)
            ),
        ),
      ],
      entries: diff.entries,
      newProducts,
      commissions,
      outOfScope: extracted.proposed
        .filter((row) => !isInScope(row))
        .map(({ productName, accessTariff, pricing }) => ({ productName, accessTariff, pricing })),
    },
    resolved,
    activePrices,
    versionRows: diff.versionRows,
  };
}

export interface ApprovalInput extends ReviewDecisions {
  /** YYYY-MM-DD. Si es futura, la versión queda programada. */
  validFrom: string;
  validTo?: string | null;
  notes?: string | null;
}

/**
 * Aprueba una ingesta: da de alta en el catálogo los productos nuevos (solo
 * Negoco), crea en el tenant las tarifas que faltan, guarda la versión con
 * sus precios y, si se piden, las comisiones. Todo el tenant en una sola
 * transacción.
 */
export async function approveIngest({
  client,
  control,
  ingest,
  input,
  user,
  isCatalogAdmin,
  today,
}: {
  client: TenantClient;
  control: Pick<Client, "execute" | "batch">;
  ingest: IngestRecord;
  input: ApprovalInput;
  user: { id: string };
  isCatalogAdmin: boolean;
  today: string;
}): Promise<{ versionId: string | null; status: RateVersion["status"] | null }> {
  if (!["ready", "needs_review"].includes(ingest.status)) {
    throw new RateIngestError("Esta ingesta no está pendiente de aprobación.", 409);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom)) {
    throw new RateIngestError("Indica la fecha de entrada en vigor (AAAA-MM-DD).");
  }

  const built = await buildReview({ client, control, ingest, today, decisions: input });
  if (!built) throw new RateIngestError("La ingesta no tiene una extracción revisable.", 409);
  const { review, versionRows } = built;

  const blocking = review.issues.filter(({ severity }) => severity === "blocking");
  if (blocking.length > 0) {
    throw new RateIngestError(
      `Quedan incidencias por resolver: ${blocking.map(({ message }) => message).join(" · ")}`,
    );
  }
  if (review.newProducts.length > 0 && !isCatalogAdmin) {
    throw new RateIngestError(
      `Estos productos no están en el catálogo y solo Negoco puede darlos de alta: ${review.newProducts.join(", ")}. Exclúyelos o pide el alta.`,
      403,
    );
  }

  const includeCommissions = input.includeCommissions ?? true;
  if (versionRows.length === 0 && !(includeCommissions && review.commissions.length > 0)) {
    throw new RateIngestError("No hay ninguna fila que guardar.");
  }

  const supplierKey = normalizeName(review.supplier.name);

  // 1. Catálogo (base de control): productos nuevos.
  const newKeys = new Map<string, { productName: string; accessTariffs: Set<string> }>();
  for (const row of versionRows) {
    if (row.catalogRateId || row.rateId) continue;
    const entry = newKeys.get(row.productKey) ?? {
      productName: row.productName,
      accessTariffs: new Set<string>(),
    };
    entry.accessTariffs.add(row.accessTariff);
    newKeys.set(row.productKey, entry);
  }
  let catalogIds = new Map<string, string>();
  if (newKeys.size > 0) {
    await control.batch(
      [...newKeys].map(([productKey, entry]) =>
        insertCatalogRateStatement({
          id: randomUUID(),
          supplierKey,
          supplierName: review.supplier.name,
          productName: entry.productName,
          productKey,
          accessTariffs: [...entry.accessTariffs].join(","),
          createdBy: user.id,
        }),
      ),
      "write",
    );
    const { catalog } = await listCatalog(control, supplierKey);
    catalogIds = new Map(catalog.map((rate) => [rate.productKey, rate.id]));
  }

  // 2. Tenant: tarifas que faltan, enlaces al catálogo, versión, precios y comisiones.
  const statements: InStatement[] = [];
  const createdRates = new Map<string, string>();
  const rows = versionRows.map((row) => {
    if (row.rateId) {
      if (row.catalogRateId) {
        statements.push({
          sql: `UPDATE comercializadora_rates SET catalog_rate_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND catalog_rate_id IS NULL`,
          args: [row.catalogRateId, row.rateId],
        });
      }
      return { ...row, rateId: row.rateId };
    }
    let rateId = createdRates.get(row.productKey);
    if (!rateId) {
      rateId = randomUUID();
      createdRates.set(row.productKey, rateId);
      statements.push(
        insertTenantRateStatement({
          id: rateId,
          name: row.productName,
          comercializadoraId: review.supplier.id,
          catalogRateId: row.catalogRateId ?? catalogIds.get(row.productKey) ?? null,
          accessTariff: row.accessTariff,
        }),
      );
    }
    return { ...row, rateId };
  });

  let versionId: string | null = null;
  let status: RateVersion["status"] | null = null;
  if (rows.length > 0) {
    versionId = randomUUID();
    const version = insertVersionStatements({
      version: {
        id: versionId,
        comercializadoraId: review.supplier.id,
        validFrom: input.validFrom,
        validTo: input.validTo ?? review.validTo ?? null,
        source: "document",
        ingestId: ingest.id,
        basedOnVersionId: review.partialUpdate ? (review.activeVersion?.id ?? null) : null,
        notes: input.notes ?? null,
        userId: user.id,
      },
      today,
    });
    status = version.status;
    statements.push(...version.statements);
    const location = ingest.files[0]?.name ?? (ingest.emailSubject || "texto pegado");
    for (const row of rows) {
      statements.push(
        insertPriceStatement(versionId, {
          ...row,
          sourceLocation: location,
          sourceExcerpt: row.sourceExcerpt,
          sourceValues: row.sourceValues,
        }),
      );
    }
  }

  if (includeCommissions && review.commissions.length > 0) {
    statements.push(
      ...replaceCommissionRulesStatements({
        comercializadoraId: review.supplier.id,
        rules: review.commissions,
        validFrom: input.validFrom,
        ingestId: ingest.id,
        userId: user.id,
      }),
    );
  }

  statements.push(
    decideIngestStatement(ingest.id, { status: "approved", userId: user.id, versionId }),
  );
  await client.batch(statements, "write");
  return { versionId, status };
}

export async function rejectIngest({
  client,
  ingest,
  user,
}: {
  client: TenantClient;
  ingest: IngestRecord;
  user: { id: string };
}) {
  if (["approved", "rejected", "processing"].includes(ingest.status)) {
    throw new RateIngestError("Esta ingesta ya está decidida o se está procesando.", 409);
  }
  await client.batch(
    [decideIngestStatement(ingest.id, { status: "rejected", userId: user.id, versionId: null })],
    "write",
  );
}
