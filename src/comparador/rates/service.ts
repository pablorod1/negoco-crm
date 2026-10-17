import type { Client, InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { buildDiff, type DiffEntry, type ResolvedRow } from "./diff";
import { prepareDocument } from "./document";
import { controlReadingCache, fileHash, worthSharing, type ReadingCache } from "./reading-cache";
import { extractRateDocument, type RateExtractionResult } from "./extract";
import { matchProducts, type RateMatch } from "./match";
import { normalizeName, productKeyOf, withoutSupplierName } from "./names";
import { nameTokens, ruleCoversRate } from "@/comparador/engine/commission";
import { energyOfTariff } from "@/comparador/gas/regulated";
import { powerToPerDay, toProposedCommissions } from "./normalize";
import {
  claimIngest,
  createIngest,
  decideIngestStatement,
  findApprovedIngestByHash,
  getActiveVersion,
  getComercializadora,
  getVersionPrices,
  insertCatalogRateStatement,
  insertPriceStatement,
  insertTenantRateStatement,
  insertVersionStatements,
  listCatalog,
  listTenantRates,
  releaseIngest,
  replaceCommissionRulesStatements,
  reserveIngestForApproval,
  recordAutoApproval,
  saveIngestResult,
  setIngestFileHash,
  supersedeEarlierIngests,
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

/**
 * Día en España de una marca de SQLite («2026-10-16 22:45:34», en UTC): el
 * día UTC cambia de fecha entre las 22:00 y las 00:00 en verano.
 */
export function dayInSpain(timestamp: string): string {
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(timestamp) ? timestamp : `${timestamp.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? timestamp.slice(0, 10) : todayInSpain(date);
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
  readings = controlReadingCache(),
}: {
  client: TenantClient;
  ingest: IngestRecord;
  tenantSlug: string;
  userId: string | null;
  extract?: typeof extractRateDocument;
  readFile?: typeof readIngestFile;
  /** Lecturas compartidas entre tenants; `null` para leer siempre. */
  readings?: ReadingCache | null;
}): Promise<IngestRecord["status"]> {
  if (!(await claimIngest(client, ingest.id))) {
    throw new RateIngestError("La ingesta ya se está procesando o ya está decidida.", 409);
  }

  try {
    const file = ingest.files[0];
    const data = file ? await readFile(file) : null;
    const sha256 = data ? fileHash(data) : null;
    if (sha256) {
      await setIngestFileHash(client, ingest.id, sha256);
      // El mismo fichero reenviado (dos personas, dos veces): ya está aprobado.
      const approved = ingest.createdBy?.startsWith(PENDING_PART_PREFIX)
        ? null
        : await findApprovedIngestByHash(client, sha256, ingest.id);
      if (approved) {
        await client.batch(
          [
            decideIngestStatement(ingest.id, { status: "rejected", userId: "comparador:ingest", versionId: null }),
            {
              sql: "UPDATE rate_ingests SET error = ? WHERE id = ?",
              args: [
                `Este anexo ya se aprobó${approved.decidedAt ? ` el ${approved.decidedAt.slice(0, 10)}` : ""}: es el mismo fichero.`,
                ingest.id,
              ],
            },
          ],
          "write",
        );
        return "rejected";
      }
    }

    // La primera lectura de un fichero que otro tenant ya leyó bien es
    // gratis. «Volver a leer» desde la revisión llama siempre a la IA.
    const shared = sha256 && readings && ingest.status === "received" ? await readings.find(sha256) : null;
    if (shared) console.info("[comparador] lectura reutilizada", { tenantSlug, id: ingest.id, from: shared.tenantSlug });
    const result = shared
      ? { ...shared.result, costUsd: null }
      : await extract({
          document: await prepareDocument(
            file && data
              ? { kind: "file", name: file.name, mime: file.mime, data }
              : { kind: "text", text: ingest.bodyText ?? "", html: /<\w+[^>]*>/.test(ingest.bodyText ?? "") },
          ),
          context: {
            tenantSlug,
            jobType: "rate_extraction",
            userId: userId ?? undefined,
            subjectId: ingest.id,
          },
          supplierName: ingest.comercializadoraId
            ? ((await getComercializadora(client, ingest.comercializadoraId))?.name ?? null)
            : null,
          // Un anexo que llegó por correo trae el cuerpo del mensaje como contexto.
          emailNote: file ? ingest.bodyText : null,
          fileName: file?.name ?? null,
        });
    if (sha256 && file && readings && !shared && worthSharing(result)) {
      await readings.save({ sha256, fileName: file.name, result, tenantSlug });
    }

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
    if (status !== "out_of_scope" && comercializadoraId && file) {
      await supersedeEarlierIngests(client, { id: ingest.id, comercializadoraId, fileName: file.name });
    }
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
  /** El nivel como lo trae el anexo («S»), si se ha traducido al de las tarifas («SUPER (N1)»). */
  documentLevel: string | null;
  /**
   * Tarifas de la comercializadora a las que se aplicaría (vigentes o de este
   * documento), para ver en la revisión si casa bien. Vacío: no se aplica a
   * ninguna, y `uncovered` dice por qué.
   */
  covers: string[];
  uncovered: string | null;
  /** La añadió quien revisa (o se recuerda de un anexo anterior), no la lectura. */
  manual?: boolean;
}

/**
 * Un nivel del anexo de comisiones que no se llama como los de las tarifas:
 * Axpo paga por «S», «E» y «X» y sus precios dicen «SUPER (N1)», «N2» y «N3».
 */
export interface CommissionLevelChoice {
  level: string;
  energy: "electricity" | "gas";
  /** Nivel de las tarifas al que equivale; null si nadie lo ha dicho. */
  mappedTo: string | null;
  /** Lo eligió quien revisa, se recuerda de otro anexo o se deduce («S» → «SUPER (N1)»). */
  source: "reviewer" | "remembered" | "suggested" | null;
  /** Niveles de las tarifas de esa energía. */
  options: string[];
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
  /** Productos que no están en el catálogo: se dan de alta al aprobar. */
  newProducts: string[];
  commissions: ProposedCommission[];
  /** Niveles de comisión que hay que traducir a los de las tarifas. */
  commissionLevels: CommissionLevelChoice[];
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
  /**
   * Nivel de las tarifas que corresponde a cada nivel del anexo de
   * comisiones («S» → «SUPER (N1)»); null: no equivale a ninguno.
   */
  levelMap?: Readonly<Record<string, string | null>>;
  /**
   * rowKey → si la tarifa es de precio base (admite el fee de la agencia) o
   * cerrada. Corrige lo que no detecta la lectura y se hereda en los anexos
   * siguientes.
   */
  feeOverrides?: Readonly<Record<string, boolean>>;
  /**
   * Reglas de comisión que añade quien revisa porque el anexo las dice con una
   * frase que la lectura no convierte («del COE te llevas el 70%»). Se
   * recuerdan para el próximo anexo de comisiones de la comercializadora.
   */
  extraCommissions?: readonly ExtraCommission[];
}

/** Una regla de comisión escrita a mano en la revisión. */
export interface ExtraCommission {
  product: string | null;
  energy: "electricity" | "gas";
  accessTariff: string | null;
  level: string | null;
  ruleType: "fixed" | "per_mwh" | "fee_share";
  amount: number;
  minAnnualKwh?: number | null;
  maxAnnualKwh?: number | null;
}

/**
 * Nivel de las tarifas que se deduce de uno de comisiones sin preguntar: la
 * inicial o la abreviatura de una sola palabra («S», «S(uper)») frente a
 * «SUPER (N1)». Solo si hay uno; si no, lo elige quien revisa.
 */
export function suggestLevel(level: string, options: readonly string[]): string | null {
  const expanded = level.replace(/^(\p{L}+)\((\p{L}+)\)$/u, "$1$2");
  const [wanted, ...rest] = nameTokens(expanded);
  if (!wanted || rest.length > 0) return null;
  const found = options.filter((option) => nameTokens(option).some((token) => token !== wanted && token.startsWith(wanted)));
  return found.length === 1 ? found[0] : null;
}

/** Los niveles que se eligieron en el último anexo aprobado de la comercializadora. */
/** Las reglas que se añadieron a mano en el último anexo aprobado de la comercializadora. */
async function rememberedExtraCommissions(client: TenantClient, comercializadoraId: string): Promise<ExtraCommission[]> {
  const { rows } = await client.execute({
    sql: `SELECT json_extract(extraction, '$.extraCommissions') AS extra FROM rate_ingests
      WHERE comercializadora_id = ? AND status = 'approved' AND json_extract(extraction, '$.extraCommissions') IS NOT NULL
      ORDER BY decided_at DESC LIMIT 1`,
    args: [comercializadoraId],
  });
  try {
    return rows[0]?.extra ? (JSON.parse(String(rows[0].extra)) as ExtraCommission[]) : [];
  } catch {
    return [];
  }
}

async function rememberedLevelMap(client: TenantClient, comercializadoraId: string): Promise<Record<string, string | null>> {
  const { rows } = await client.execute({
    sql: `SELECT json_extract(extraction, '$.levelMap') AS level_map FROM rate_ingests
      WHERE comercializadora_id = ? AND status = 'approved' AND json_extract(extraction, '$.levelMap') IS NOT NULL
      ORDER BY decided_at DESC LIMIT 1`,
    args: [comercializadoraId],
  });
  try {
    return rows[0]?.level_map ? (JSON.parse(String(rows[0].level_map)) as Record<string, string | null>) : {};
  } catch {
    return {};
  }
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
  const feeOverrides = decisions.feeOverrides ?? {};
  const kept = inScope
    .filter((row) => !excluded.has(rowKey(row)))
    .map((read) => {
      const decided = feeOverrides[rowKey(read)];
      const row =
        decided === undefined
          ? read
          : decided
            ? { ...read, feeEnergyMinPerMwh: read.feeEnergyMinPerMwh ?? 0, feeDecided: true }
            : { ...read, feeEnergyMinPerMwh: null, feeEnergyMaxPerMwh: null, feeDecided: true };
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

  // Las añadidas a mano: las de esta revisión o, si no se han tocado, las del
  // anexo anterior (solo si este trae comisiones: uno de precios no las toca).
  const readRules = toProposedCommissions(extracted.extraction);
  const extra =
    decisions.extraCommissions ?? (readRules.length > 0 ? await rememberedExtraCommissions(client, supplier.id) : []);
  const proposedRules = [
    ...readRules.map((rule) => ({ ...rule, manual: false })),
    ...extra.map((rule) => ({
      energy: rule.energy,
      productName: rule.product,
      productKey: rule.product ? productKeyOf(rule.product) : null,
      product: rule.product,
      accessTariff: rule.accessTariff,
      pricing: null,
      pricingStated: false,
      level: rule.level,
      channel: null,
      minAnnualKwh: rule.minAnnualKwh ?? null,
      maxAnnualKwh: rule.maxAnnualKwh ?? null,
      minKw: null,
      maxKw: null,
      ruleType: rule.ruleType,
      feeBase: "energy" as const,
      amount: rule.amount,
      minAmount: null,
      manual: true,
    })),
  ].map((rule) => {
    if (!rule.product) return rule;
    const product = withoutSupplierName(rule.product, supplier.name);
    return { ...rule, product, productName: product, productKey: productKeyOf(product) };
  });
  const commissionMatches = matchProducts(
    proposedRules
      .filter((rule) => rule.productKey)
      .map((rule) => ({ productKey: rule.productKey!, productName: rule.productName! })),
    { tenantRates, catalog, aliases },
  );
  const coverable = [
    ...activePrices.map((price) => ({
      rateId: price.rateId,
      productName: price.rateName,
      level: price.level,
      accessTariff: price.accessTariff,
      pricing: price.pricing,
    })),
    ...resolved.map((row) => ({
      rateId: row.match.rateId ?? `new:${row.productKey}`,
      productName: row.productName,
      level: row.level,
      accessTariff: row.accessTariff,
      pricing: row.pricing,
    })),
  ];
  // Una regla de gas solo puede cubrir tarifas de gas, y la de un peaje, las de ese peaje.
  const ratesFor = (rule: Pick<ProposedCommission, "energy" | "accessTariff">) =>
    coverable.filter(
      (rate) =>
        energyOfTariff(rate.accessTariff) === (rule.energy ?? "electricity") &&
        (!rule.accessTariff || rule.accessTariff === rate.accessTariff),
    );

  // Niveles del anexo que no aparecen en ninguna tarifa de su energía.
  const remembered = decisions.levelMap ? {} : await rememberedLevelMap(client, supplier.id);
  const commissionLevels: CommissionLevelChoice[] = [];
  for (const rule of proposedRules) {
    const energy = rule.energy ?? "electricity";
    if (!rule.level || commissionLevels.some((choice) => choice.level === rule.level && choice.energy === energy)) continue;
    const rates = ratesFor({ energy, accessTariff: null });
    if (rates.length === 0) continue;
    // Casa si alguna tarifa lo tiene de nivel (o en el nombre), o si alguna
    // regla con ese nivel cubre una tarifa de su producto («TPoolE0» en
    // «TRADERPOOL S3826 TRADERPOOL 0»).
    const sameLevel = proposedRules.filter((other) => other.level === rule.level && (other.energy ?? "electricity") === energy);
    if (
      rates.some(
        (rate) =>
          ruleCoversRate({ rateId: null, product: null, level: rule.level }, rate) ||
          sameLevel.some((other) => ruleCoversRate({ rateId: null, product: other.product, level: rule.level }, rate)),
      )
    ) {
      continue;
    }
    // Se elige entre los niveles de las tarifas; si no tienen (Eleia lleva el
    // nivel en el nombre), entre las tarifas de los productos de esas reglas.
    const levels = [...new Set(rates.flatMap(({ level }) => (level ? [level] : [])))];
    const ofProducts = rates.filter((rate) =>
      sameLevel.some((other) => ruleCoversRate({ rateId: null, product: other.product, level: null }, rate)),
    );
    // Si ninguna tarifa se llama como sus productos, el problema no es el
    // nivel: cada regla ya lo avisa («Ninguna tarifa se llama…»).
    if (ofProducts.length === 0 && sameLevel.every((other) => other.product)) continue;
    const options = (levels.length ? levels : [...new Set((ofProducts.length ? ofProducts : rates).map(({ productName }) => productName))]).sort(
      (a, b) => a.localeCompare(b, "es"),
    );
    const chosen = decisions.levelMap && rule.level in decisions.levelMap ? decisions.levelMap[rule.level] : undefined;
    const kept = rule.level in remembered ? remembered[rule.level] : undefined;
    const suggested = suggestLevel(rule.level, options);
    const mappedTo = chosen !== undefined ? chosen : kept !== undefined ? kept : suggested;
    commissionLevels.push({
      level: rule.level,
      energy,
      mappedTo: mappedTo && options.includes(mappedTo) ? mappedTo : null,
      source: chosen !== undefined ? "reviewer" : kept !== undefined ? "remembered" : suggested ? "suggested" : null,
      options,
    });
  }
  const levelOf = (level: string | null, energy: "electricity" | "gas") =>
    commissionLevels.find((choice) => choice.level === level && choice.energy === energy)?.mappedTo ?? level;

  const commissions = proposedRules.map((rule): ProposedCommission => {
    const energy = rule.energy ?? "electricity";
    const level = levelOf(rule.level, energy);
    const rates = ratesFor(rule);
    // Se ata a la tarifa que se llama igual solo si tiene precios de su
    // energía y su peaje: la «TU DECIDES» de gas de Eleia se quedaba con las
    // comisiones de luz de «TU DECIDES», que son de «TU DECIDES TDE 0»…
    const matched = rule.productKey ? (commissionMatches.get(rule.productKey)?.rateId ?? null) : null;
    const rateId = matched && rates.some((rate) => rate.rateId === matched) ? matched : null;
    const covers = ratesCoveredBy({ rateId, product: rule.product, level }, rates);
    const named = rates.filter((rate) => ruleCoversRate({ rateId, product: rule.product, level: null }, rate));
    // Si el nombre no dice fijo o indexado, mandan las tarifas que nombra; sin
    // tarifas, vale para las dos. La lectura de Axpo dio «fijo» a Dinámica,
    // que es su indexada, y nunca se habría aplicado.
    const namedPricing = new Set(named.map(({ pricing }) => (pricing === "indexed" ? "indexed" : "fixed")));
    const pricing = rule.pricingStated
      ? rule.pricing
      : rule.product && namedPricing.size === 1
        ? [...namedPricing][0]
        : rule.product
          ? null
          : rule.pricing;
    const uncovered =
      covers.length > 0
        ? null
        : rates.length === 0
          ? `Aún no hay tarifas de ${energy === "gas" ? `gas${rule.accessTariff ? ` ${rule.accessTariff}` : ""}` : (rule.accessTariff ?? "luz")} de ${supplier.name}: se aplicará cuando las haya.`
          : named.length === 0
            ? `Ninguna tarifa de ${supplier.name} se llama «${rule.product}»: se aplicará cuando haya una.`
            : // El gas indexado de Eleia: su nivel no importa si no hay tarifas de ese tipo de precio.
              pricing && !named.some((rate) => (rate.pricing === "indexed" ? "indexed" : "fixed") === pricing)
              ? `Aún no hay tarifas «${rule.product}» de precio ${pricing === "indexed" ? "indexado" : "fijo"}: se aplicará cuando las haya.`
              : `Ninguna tarifa «${rule.product}» tiene el nivel «${rule.level}»: indica arriba a qué nivel equivale.`;
    return {
      productName: rule.productName,
      rateId,
      product: rule.product,
      accessTariff: rule.accessTariff,
      energy: rule.energy,
      pricing,
      level,
      documentLevel: level !== rule.level ? rule.level : null,
      channel: rule.channel,
      minAnnualKwh: rule.minAnnualKwh,
      maxAnnualKwh: rule.maxAnnualKwh,
      minKw: rule.minKw,
      maxKw: rule.maxKw,
      ruleType: rule.ruleType,
      feeBase: rule.feeBase,
      amount: rule.amount,
      minAmount: rule.minAmount,
      covers,
      uncovered,
      manual: rule.manual,
    };
  });

  // Las incidencias de filas excluidas ya no cuentan; la potencia regulada
  // elegida por el revisor resuelve la que faltaba, y también la de la versión
  // activa: un anexo que no repite la potencia conserva la que había (regulada
  // o la que se escribió a mano), sin preguntar otra vez.
  const inheritedPower = new Set(
    diff.entries.filter(({ active, proposed }) => active && proposed && !proposed.powerStated).map(({ rowKey: key }) => key),
  );
  const extractionIssues = extracted.issues.filter(
    (issue) =>
      !(issue.rowKey && excluded.has(issue.rowKey)) &&
      !(
        issue.code === "missing_power" &&
        issue.rowKey &&
        (regulated.has(issue.rowKey) || manual[issue.rowKey] || inheritedPower.has(issue.rowKey))
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
        // Un anexo solo de comisiones: la fecha que falta es la de las comisiones.
        ...extractionIssues.map((issue) =>
          issue.code === "missing_valid_from" && inScope.length === 0 && commissions.length > 0
            ? { ...issue, message: "El documento no indica desde cuándo valen las comisiones: revisa la fecha de abajo." }
            : issue,
        ),
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
      commissionLevels,
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
 * Aprueba una ingesta: da de alta en el catálogo los productos nuevos,
 * crea en el tenant las tarifas que faltan, guarda la versión con
 * sus precios y, si se piden, las comisiones. Todo el tenant en una sola
 * transacción.
 */
export async function approveIngest({
  client,
  control,
  ingest,
  input,
  user,
  today,
}: {
  client: TenantClient;
  control: Pick<Client, "execute" | "batch">;
  ingest: IngestRecord;
  input: ApprovalInput;
  user: { id: string };
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
  const { review } = built;
  // Un anexo que no trae ningún precio (solo comisiones) no crea versión: si
  // no, copiaría los precios vigentes con la fecha del anexo y movería sus
  // fechas (una versión con fecha anterior a la vigente, o sin su fin).
  const versionRows = review.entries.some(({ kind }) => kind !== "carried") ? built.versionRows : [];

  const blocking = review.issues.filter(({ severity }) => severity === "blocking");
  if (blocking.length > 0) {
    throw new RateIngestError(
      `Quedan incidencias por resolver: ${blocking.map(({ message }) => message).join(" · ")}`,
    );
  }

  const includeCommissions = input.includeCommissions ?? true;
  if (versionRows.length === 0 && !(includeCommissions && review.commissions.length > 0)) {
    throw new RateIngestError("No hay ninguna fila que guardar.");
  }

  // Reserva: si el buzón y una persona (o dos personas) aprueban a la vez,
  // solo escribe uno; el otro saldría con otra versión y productos repetidos.
  if (!(await reserveIngestForApproval(client, ingest.id))) {
    throw new RateIngestError("Esta ingesta ya se está aprobando o ya está decidida.", 409);
  }
  let written = false;
  try {
    const supplierKey = normalizeName(review.supplier.name);

    // 1. Catálogo (base de control): productos nuevos.
    const newKeys = new Map<string, { productName: string; pricing: string; accessTariffs: Set<string> }>();
    for (const row of versionRows) {
      if (row.catalogRateId || row.rateId) continue;
      const entry = newKeys.get(row.productKey) ?? {
        productName: row.productName,
        pricing: row.pricing,
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
            pricing: entry.pricing,
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
            pricing: row.pricing,
          }),
        );
      }
      return { ...row, rateId };
    });

    let versionId: string | null = null;
    let status: RateVersion["status"] | null = null;
    // Una versión que empieza antes que la vigente la cerraría antes de su
    // inicio y dejaría las fechas del revés.
    const active = review.activeVersion;
    if (rows.length > 0 && active?.validFrom && input.validFrom < active.validFrom) {
      throw new RateIngestError(
        `La versión vigente empieza el ${active.validFrom}: la fecha de entrada en vigor no puede ser anterior.`,
      );
    }
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
    // Los niveles elegidos se recuerdan para el próximo anexo de comisiones.
    const levelMap = Object.fromEntries(review.commissionLevels.map(({ level, mappedTo }) => [level, mappedTo]));
    if (includeCommissions && Object.keys(levelMap).length > 0) {
      statements.push({
        sql: `UPDATE rate_ingests SET extraction = json_set(extraction, '$.levelMap', json(?)) WHERE id = ?`,
        args: [JSON.stringify(levelMap), ingest.id],
      });
    }
    // Y las reglas añadidas a mano, también.
    if (includeCommissions && input.extraCommissions) {
      statements.push({
        sql: `UPDATE rate_ingests SET extraction = json_set(extraction, '$.extraCommissions', json(?)) WHERE id = ?`,
        args: [JSON.stringify(input.extraCommissions), ingest.id],
      });
    }
    await client.batch(statements, "write");
    written = true;
    return { versionId, status };
  } finally {
    if (!written) await releaseIngest(client, ingest.id, ingest.status);
  }
}

/** Por qué un anexo del buzón no se ha aprobado solo. */
export type AutoApproval =
  | {
      approved: true;
      versionId: string | null;
      /** Si se ha apartado algo: la ingesta en revisión y cuántas tarifas se han aprobado. */
      pendingIngestId?: string;
      approvedRows?: number;
      totalRows?: number;
    }
  | { approved: false; reason: string };

/**
 * Aprobación sin nadie, para lo que llega al buzón de un remitente de
 * confianza: la idea es que actualizar precios sea enviar un correo. Entra
 * solo si la lectura es fiable (sin incidencias bloqueantes: cada cifra está
 * en el documento) y con estas reglas:
 * - nunca retira productos: Nordy manda un PDF por producto y se pisarían;
 * - los productos nuevos se dan de alta en el catálogo;
 * - vale desde la fecha del documento si la trae, o desde el día del correo;
 * - un anexo anterior a los precios vigentes no los pisa: se descarta.
 */
interface AutoApprovalInput {
  client: TenantClient;
  control: Pick<Client, "execute" | "batch">;
  ingest: IngestRecord;
  approvedBy: string;
  /** Día en que llegó el correo (YYYY-MM-DD), si el documento no da fecha. */
  receivedOn: string;
  today: string;
}

/**
 * Aprueba sola una ingesta del tenant si no tiene dudas. Si no puede, guarda
 * en la ingesta por qué, para enseñarlo y para medir cuánto se aprueba solo.
 */
export async function autoApproveIngest(input: AutoApprovalInput): Promise<AutoApproval> {
  const result = await tryAutoApprove(input);
  if (!result.approved) await recordAutoApproval(input.client, input.ingest.id, { approved: false, reason: result.reason });
  return result;
}

async function tryAutoApprove({
  client,
  control,
  ingest,
  approvedBy,
  receivedOn,
  today,
}: AutoApprovalInput): Promise<AutoApproval> {
  // Una lectura «en revisión» también vale si sus dudas se resuelven solas
  // (la potencia que se hereda de la versión activa).
  if (!["ready", "needs_review"].includes(ingest.status)) {
    return { approved: false, reason: `la lectura ha quedado en «${ingest.status}»` };
  }
  if (!ingest.comercializadoraId) {
    return { approved: false, reason: "no se ha reconocido la comercializadora del anexo" };
  }
  const built = await buildReview({ client, control, ingest, today, decisions: { partialUpdate: true } });
  if (!built) return { approved: false, reason: "no hay una lectura que aprobar" };

  // Lo dudoso se aparta y se aprueba el resto: una fila con una cifra que no
  // está en el documento no tiene por qué parar las otras nueve. Lo que afecta
  // al anexo entero (una plantilla que no encaja) no se aprueba en parte.
  const blocking = built.review.issues.filter(({ severity }) => severity === "blocking");
  const isCommission = (code: string) => code.startsWith("commission");
  const whole = blocking.filter(({ rowKey: key, code }) => !key && !isCommission(code));
  if (whole.length > 0) {
    return { approved: false, reason: whole.map(({ message }) => message).join(" · ") };
  }
  const doubtfulRows = [...new Set(blocking.flatMap(({ rowKey: key, code }) => (key && !isCommission(code) ? [key] : [])))];
  // Una comisión con un nivel que no casa con ninguna tarifa no pagaría nunca.
  const unmapped = built.review.commissionLevels.filter(({ mappedTo }) => !mappedTo).map(({ level }) => `«${level}»`);
  const commissionDoubts = [
    ...blocking.filter(({ code }) => isCommission(code)).map(({ message }) => message),
    // Una sección de comisiones que no se ha podido leer: sin ella, esa comisión no se pagaría.
    ...built.review.issues.filter(({ code }) => code === "commission_unread").map(({ message }) => message),
    ...(unmapped.length > 0 ? [`los niveles de comisión ${unmapped.join(", ")} no casan con ninguna tarifa`] : []),
  ];
  const decisions: ReviewDecisions = {
    partialUpdate: true,
    excludedRowKeys: doubtfulRows,
    includeCommissions: commissionDoubts.length === 0,
  };
  const pendingReason = [
    ...blocking.filter(({ rowKey: key, code }) => key && !isCommission(code)).map(({ message }) => message),
    ...commissionDoubts,
  ].join(" · ");

  const kept = doubtfulRows.length > 0 || commissionDoubts.length > 0
    ? await buildReview({ client, control, ingest, today, decisions })
    : built;
  if (!kept) return { approved: false, reason: "no hay una lectura que aprobar" };
  const { review } = kept;
  const rowsToSave = review.entries.filter(({ kind }) => kind !== "carried").length;
  const commissionsToSave = decisions.includeCommissions ? review.commissions.length : 0;
  if (rowsToSave === 0 && commissionsToSave === 0) {
    return { approved: false, reason: pendingReason || "no hay ninguna fila que guardar" };
  }

  const validFrom = review.validFrom ?? receivedOn;
  const active = review.activeVersion;
  if (active?.validFrom && validFrom < active.validFrom) {
    const reason = `El anexo es del ${validFrom} y los precios vigentes son desde el ${active.validFrom}: no se aplica.`;
    await client.batch(
      [
        decideIngestStatement(ingest.id, { status: "rejected", userId: approvedBy, versionId: null }),
        { sql: "UPDATE rate_ingests SET error = ? WHERE id = ?", args: [reason, ingest.id] },
      ],
      "write",
    );
    return { approved: false, reason };
  }

  const { versionId } = await approveIngest({
    client,
    control,
    ingest,
    input: { ...decisions, validFrom, notes: "Aprobada sola: llegó al buzón de anexos" },
    user: { id: approvedBy },
    today,
  });
  if (!pendingReason) return { approved: true, versionId };

  // Lo apartado queda en una ingesta aparte, para que lo revise Negoco.
  const pendingIngestId = await createPendingPart(client, ingest, {
    rowKeys: doubtfulRows,
    commissions: commissionDoubts.length > 0,
    validFrom,
    reason: pendingReason,
  });
  const totalRows = rowsToSave + doubtfulRows.length;
  await recordAutoApproval(client, ingest.id, {
    approved: true,
    reason: pendingReason,
    approvedRows: rowsToSave,
    totalRows,
    pendingIngestId,
  });
  return { approved: true, versionId, pendingIngestId, approvedRows: rowsToSave, totalRows };
}

/** Prefijo de `created_by` de una parte pendiente: la ingesta de la que sale. */
export const PENDING_PART_PREFIX = "comparador:parte-de:";

/**
 * Las filas (y, si toca, las comisiones) que la aprobación automática ha
 * apartado de un anexo, como una ingesta nueva en revisión. Lleva la misma
 * lectura recortada y el mismo fichero, para verlo y volver a leerlo.
 */
async function createPendingPart(
  client: TenantClient,
  parent: IngestRecord,
  { rowKeys, commissions, validFrom, reason }: { rowKeys: string[]; commissions: boolean; validFrom: string; reason: string },
): Promise<string> {
  const result = parent.extraction as ExtractedResult;
  const keep = new Set(rowKeys);
  const indexes = result.proposed.flatMap((row, index) => (keep.has(rowKey(row)) ? [index] : []));
  const extraction: ExtractedResult = {
    ...result,
    extraction: {
      ...result.extraction,
      validFrom: result.extraction.validFrom ?? validFrom,
      rates: indexes.map((index) => result.extraction.rates[index]),
      commissions: commissions ? result.extraction.commissions : [],
    },
    proposed: indexes.map((index) => result.proposed[index]),
    issues: result.issues.filter(({ rowKey: key, code }) =>
      key ? keep.has(key) : code.startsWith("commission") ? commissions : true,
    ),
  };
  const id = await createIngest(client, {
    channel: parent.channel,
    comercializadoraId: parent.comercializadoraId,
    files: parent.files,
    bodyText: parent.bodyText,
    emailFrom: parent.emailFrom,
    emailSubject: parent.emailSubject,
    createdBy: `${PENDING_PART_PREFIX}${parent.id}`,
  });
  await saveIngestResult(client, id, {
    status: "needs_review",
    comercializadoraId: parent.comercializadoraId,
    classification: result.classification,
    extraction: { ...extraction, autoApproval: { approved: false, reason, at: new Date().toISOString() } },
    validation: extraction.issues,
    models: [],
    costUsd: null,
  });
  return id;
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
