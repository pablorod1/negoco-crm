import type { Client } from "@libsql/client";
import { getRegulatedParams } from "@/comparador/engine/regulated";
import { currentTariffFromInvoice } from "@/comparador/extraction/current-tariff";
import { extractInvoice } from "@/comparador/extraction/extract-invoice";
import { redactInvoiceText } from "@/comparador/redaction/redact";
import {
  listActiveOfferPrices,
  listCurrentCommissionRules,
} from "@/comparador/rates/repository";
import type {
  ApoloSipsElectricityConsumptionRow,
  ApoloSipsElectricityPointSupplyRow,
  ApoloSipsProcedure,
  ApoloSipsProcedureResult,
  ApoloSipsProcedureRow,
} from "@/integrations/apolo-sips/types";
import { invoiceTextFromPdf } from "./invoice-text";
import { rankStudy, type StudyRanking } from "./ranking";
import {
  createStudy,
  type SavedStudyOptions,
  type StudyRecord,
} from "./repository";
import { detectSupplierInText } from "./supplier";
import { buildSupply, SupplyUnavailableError } from "./supply";

type TenantClient = Pick<Client, "execute" | "batch">;

/** Un error que se enseña tal cual a quien hace el estudio. */
export class StudyError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "StudyError";
  }
}

/** Consulta al SIPS; null si no se puede (sin clave, caído, CUPS desconocido). */
export type SipsFetcher = (
  cups: string,
  procedure: ApoloSipsProcedure,
) => Promise<ApoloSipsProcedureResult<ApoloSipsProcedureRow> | null>;

export interface InvoiceForStudy {
  data: Uint8Array;
  fileName: string;
  fileId: string | null;
  mime: string;
}

/**
 * Analiza la factura de una comparativa: texto del PDF, anonimizado en local
 * (a la IA solo llegan los conceptos y cifras), extracción, suministro (SIPS
 * con el CUPS leído en local, o la factura) y lo que paga hoy. Guarda el
 * estudio; el ranking se calcula al verlo.
 */
export async function analyzeInvoice({
  client,
  tenantSlug,
  comparativaId,
  userId,
  invoice,
  channel,
  today,
  fetchSips,
  extract = extractInvoice,
}: {
  client: TenantClient;
  tenantSlug: string;
  comparativaId: string;
  userId: string;
  invoice: InvoiceForStudy;
  channel: SavedStudyOptions["channel"];
  today: string;
  fetchSips: SipsFetcher;
  extract?: typeof extractInvoice;
}): Promise<string> {
  if (invoice.mime !== "application/pdf" && !/\.pdf$/i.test(invoice.fileName)) {
    throw new StudyError("De momento el estudio lee facturas en PDF. Sube el PDF de la comercializadora.");
  }
  const { text } = await invoiceTextFromPdf(invoice.data);
  if (!text) {
    throw new StudyError(
      "La factura es una imagen escaneada y no se puede leer sin enviar sus datos personales. Sube el PDF original de la comercializadora.",
    );
  }

  const redaction = redactInvoiceText(text);
  if (redaction.leaks.length > 0) {
    throw new StudyError(
      "No se ha podido tapar todos los datos personales de esta factura, así que no se envía a analizar. Avisa a soporte con la comparativa.",
    );
  }
  const cups = redaction.identifiers.cups[0] ?? null;

  const extraction = await extract({
    file: { text: redaction.text },
    context: { tenantSlug, jobType: "invoice_extraction", userId, subjectId: comparativaId },
    knownCups: cups,
  });
  const facts = extraction.extraction.supplierName
    ? extraction.extraction
    : { ...extraction.extraction, supplierName: await supplierFromText(client, redaction.text) };
  const aiCostUsd = extraction.attempts.reduce((sum, { costUsd }) => sum + (costUsd ?? 0), 0);

  const tariff = (facts.accessTariff ?? "").replace(/\s/g, "").toUpperCase();
  if (tariff && !tariff.startsWith("2.0")) {
    throw new StudyError(`El comparador propio compara 2.0TD; esta factura es ${facts.accessTariff}.`);
  }
  if (facts.pricing === "indexed") {
    throw new StudyError("Es una factura de precio indexado; el comparador propio compara precio fijo.");
  }

  let sipsPoint: ApoloSipsElectricityPointSupplyRow | null = null;
  let sipsConsumption: ApoloSipsElectricityConsumptionRow[] = [];
  if (cups) {
    const [point, consumption] = await Promise.all([
      fetchSips(cups, "PS").catch(() => null),
      fetchSips(cups, "CONSUMOS").catch(() => null),
    ]);
    sipsPoint = (point?.rows[0] as ApoloSipsElectricityPointSupplyRow | undefined) ?? null;
    sipsConsumption = (consumption?.rows ?? []) as ApoloSipsElectricityConsumptionRow[];
  }

  let supply;
  try {
    supply = buildSupply({ invoice: facts, sipsPoint, sipsConsumption });
  } catch (error) {
    if (error instanceof SupplyUnavailableError) throw new StudyError(error.message);
    throw error;
  }

  return createStudy(client, {
    comparativaId,
    status: "analyzed",
    invoiceFileId: invoice.fileId,
    invoiceFileName: invoice.fileName,
    cups,
    extraction: facts,
    issues: extraction.issues,
    supply,
    options: { channel, feeEnergyPerMwh: null, order: "savings" },
    priceDate: today,
    aiCostUsd,
    error: null,
    createdBy: userId,
  });
}

/** La comercializadora de la factura buscada en su texto, entre las del tenant. */
async function supplierFromText(client: TenantClient, text: string): Promise<string | null> {
  const { rows } = await client.execute("SELECT id, name FROM comercializadoras");
  const suppliers = rows.map((row) => ({ id: String(row.id), name: String(row.name ?? "") }));
  return detectSupplierInText(text, suppliers)?.name ?? null;
}

/** Ranking de un estudio con sus opciones, o con las que se prueban ahora. */
export async function rankSavedStudy({
  client,
  study,
  options,
}: {
  client: TenantClient;
  study: StudyRecord;
  options?: Partial<SavedStudyOptions>;
}): Promise<{ ranking: StudyRanking; options: SavedStudyOptions }> {
  if (!study.extraction || !study.supply) {
    throw new StudyError("Este estudio no tiene factura analizada.", 409);
  }
  const effective: SavedStudyOptions = { ...study.options, ...options };
  const [offers, rules] = await Promise.all([
    listActiveOfferPrices(client, study.priceDate),
    listCurrentCommissionRules(client, study.priceDate),
  ]);
  const ranking = rankStudy({
    supply: study.supply,
    current: currentTariffFromInvoice(study.extraction),
    offers,
    rules,
    regulated: getRegulatedParams(study.priceDate),
    options: { ...effective, date: study.priceDate },
  });
  return { ranking, options: effective };
}
