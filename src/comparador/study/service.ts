import type { Client } from "@libsql/client";
import { getRegulatedParams } from "@/comparador/engine/regulated";
import { currentTariffFromInvoice } from "@/comparador/extraction/current-tariff";
import { extractInvoice } from "@/comparador/extraction/extract-invoice";
import { clientFromInvoiceText } from "@/comparador/redaction/invoice-client";
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
import { StudyError } from "./errors";
import { needsInvoiceReview } from "./invoice-review";
import { readInvoice } from "./read-invoice";
import { rankStudy, type StudyRanking } from "./ranking";
import {
  createStudy,
  type SavedStudyOptions,
  type StudyRecord,
} from "./repository";
import { detectSupplierInText } from "./supplier";
import { annualKwhFromSips, buildSupply, SIPS_MESSAGES, SupplyUnavailableError } from "./supply";

type TenantClient = Pick<Client, "execute" | "batch">;

export { StudyError };

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
  /** Fotos de las demás páginas, en orden, cuando la factura llega en varias fotos. */
  morePages?: Uint8Array[];
}

/**
 * Analiza la factura de una comparativa: texto del PDF, anonimizado en local
 * (a la IA solo llegan los conceptos y cifras), consumo real de 12 meses del
 * SIPS con el CUPS leído en local, extracción y lo que paga hoy. Guarda el
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
  const { text, fromImage } = await readInvoice(invoice);
  // Datos del titular leídos en local: rellenan el cliente y, además, se
  // tapan en todo el texto aunque no lleven etiqueta.
  const clientData = clientFromInvoiceText(text.replace(/\t/g, "\n"));
  const redaction = redactInvoiceText(text, {
    fromImage,
    knownHolderTokens: [clientData?.name, clientData?.lastName, clientData?.address]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(/\s+/)),
  });
  if (redaction.leaks.length > 0) {
    throw new StudyError(
      "No se ha podido tapar todos los datos personales de esta factura, así que no se envía a analizar. Avisa a soporte con la comparativa.",
    );
  }
  const cups = redaction.identifiers.cups[0] ?? null;

  // Sin un año real de consumo del SIPS no hay estudio. Se comprueba antes
  // de llamar a la IA: no se gasta en una factura que no se puede comparar.
  if (!cups) {
    throw new StudyError(
      fromImage
        ? "No se lee un CUPS válido en la imagen, así que no se puede pedir al SIPS el consumo real de 12 meses. Haz una foto más nítida de la página donde viene el CUPS, o pide el PDF."
        : SIPS_MESSAGES.noCups,
    );
  }
  const [point, consumption] = await Promise.all([
    fetchSips(cups, "PS").catch(() => null),
    fetchSips(cups, "CONSUMOS").catch(() => null),
  ]);
  if (!consumption) throw new StudyError(SIPS_MESSAGES.unavailable, 503);
  const sipsPoint = (point?.rows[0] as ApoloSipsElectricityPointSupplyRow | undefined) ?? null;
  const sipsConsumption = consumption.rows as ApoloSipsElectricityConsumptionRow[];
  const sipsYear = annualKwhFromSips(sipsConsumption);
  if (!sipsYear) throw new StudyError(SIPS_MESSAGES.noReadings);
  if ("insufficient" in sipsYear) throw new StudyError(SIPS_MESSAGES.insufficient(sipsYear.months));

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
    issues: fromImage
      ? [{ code: "read_from_image", severity: "warning", field: "invoice" }, ...extraction.issues]
      : extraction.issues,
    supply,
    options: { channel, feeEnergyPerMwh: null, order: "savings" },
    priceDate: today,
    aiCostUsd,
    error: null,
    // Leídos en local del texto sin tapar: nunca han salido del CRM.
    clientData,
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
    // Sin lo que paga hoy hasta que alguien revise una lectura que no cuadra.
    current: needsInvoiceReview(study) ? null : currentTariffFromInvoice(study.extraction),
    offers,
    rules,
    regulated: getRegulatedParams(study.priceDate),
    options: { ...effective, date: study.priceDate },
  });
  return { ranking, options: effective };
}
