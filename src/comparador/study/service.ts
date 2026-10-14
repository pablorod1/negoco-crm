import type { Client } from "@libsql/client";
import { getRegulatedParams, type RegulatedParams } from "@/comparador/engine/regulated";
import {
  currentTariffFromInvoice,
  flatTariffFromInvoice,
  invoiceTaxRates,
  type CurrentTariff,
} from "@/comparador/extraction/current-tariff";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import { omieAverages, type OmieDayFetcher } from "@/comparador/market/omie";
import { NOT_INVOICE_MESSAGES, notAnInvoice } from "@/comparador/extraction/document-kind";
import { extractInvoice } from "@/comparador/extraction/extract-invoice";
import { isValidCups, normalizeIdentifier } from "@/comparador/extraction/identifiers";
import type { InvoiceIssue } from "@/comparador/extraction/validate";
import { verifyReading } from "@/comparador/extraction/verify-reading";
import { clientFromExtraction } from "@/comparador/redaction/invoice-client";
import { redactInvoiceForStudy } from "@/comparador/redaction/study-redaction";
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
import type { StudyClientData } from "./client-data";
import { invoiceImagesForVision, photoVisionEnabled, readInvoice, zoomedBands } from "./read-invoice";
import { indexedEnergyPrices, marginOverMarket } from "./indexed";
import { rankStudy, type AncillarySimulation, type CurrentPricing, type CustomerType, type StudyRanking } from "./ranking";
import {
  createStudy,
  getStudy,
  saveStudySupply,
  type SavedStudyOptions,
  type StudyRecord,
} from "./repository";
import { getDefaultAncillary } from "./settings";
import { detectSupplierInText } from "./supplier";
import { annualKwhFromSips, buildSupply, SIPS_MESSAGES, SupplyUnavailableError, type StudySupply } from "./supply";

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
  /** CUPS escrito a mano porque no se lee en la factura; ya validado. */
  cups?: string | null;
}

/** La foto se ha leído, pero sin las líneas de potencia y energía. */
const NO_DETAIL_IN_PHOTO =
  "No se ha podido leer el detalle de la factura (potencia y energía) en la foto. Si la factura tiene más páginas, súbelas todas; si no, haz otra foto de frente y con buena luz, o pide el PDF.";

interface SipsYear {
  sipsPoint: ApoloSipsElectricityPointSupplyRow | null;
  sipsConsumption: ApoloSipsElectricityConsumptionRow[];
}

/** El punto de suministro y un año de consumo del SIPS; si no hay año completo, no hay estudio. */
async function loadSipsYear(fetchSips: SipsFetcher, cups: string): Promise<SipsYear> {
  const [point, consumption] = await Promise.all([
    fetchSips(cups, "PS").catch(() => null),
    fetchSips(cups, "CONSUMOS").catch(() => null),
  ]);
  if (!consumption) throw new StudyError(SIPS_MESSAGES.unavailable, 503);
  const sipsConsumption = consumption.rows as ApoloSipsElectricityConsumptionRow[];
  const sipsYear = annualKwhFromSips(sipsConsumption);
  if (!sipsYear) throw new StudyError(SIPS_MESSAGES.noReadings);
  if ("insufficient" in sipsYear) throw new StudyError(SIPS_MESSAGES.insufficient(sipsYear.months));
  return { sipsPoint: (point?.rows[0] as ApoloSipsElectricityPointSupplyRow | undefined) ?? null, sipsConsumption };
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
  verify = verifyReading,
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
  verify?: typeof verifyReading;
}): Promise<string> {
  const context = { tenantSlug, jobType: "invoice_extraction" as const, userId, subjectId: comparativaId };
  const images = photoVisionEnabled() ? await invoiceImagesForVision(invoice) : null;

  let cups: string;
  let fromImage: boolean;
  let clientData: StudyClientData | null;
  let extraction: Awaited<ReturnType<typeof extractInvoice>>;
  let sips: SipsYear;
  let facts: InvoiceExtraction;
  // Datos que la comprobación independiente (Jev) no ve en la factura.
  let doubtful: InvoiceIssue[] = [];

  if (images) {
    // Foto o PDF escaneado con visión: la IA ve la imagen entera, con sus
    // datos. El CUPS sale de su lectura (o del escrito a mano) y el SIPS se
    // consulta después.
    fromImage = true;
    // Con franjas a su resolución: OpenAI reduce cada imagen a 768 px de lado
    // corto y la letra pequeña se perdía (Luna sola: 16 → 22 de 30 fotos).
    extraction = await extract({
      file: { pages: images, zoomed: await zoomedBands(images) },
      context,
      knownCups: invoice.cups ?? null,
    });
    const read = extraction.extraction;
    if (read.powerLines.length === 0 && read.energyLines.length === 0) throw new StudyError(NO_DETAIL_IN_PHOTO);
    const readCups = read.cups && isValidCups(read.cups) ? normalizeIdentifier(read.cups) : null;
    const found = invoice.cups ?? readCups;
    if (!found) throw new StudyError(SIPS_MESSAGES.noCupsInImage, 422, "cups_missing");
    cups = found;
    clientData = clientFromExtraction(read);
    sips = await loadSipsYear(fetchSips, cups);
    facts = read;
  } else {
    const reading = await readInvoice(invoice);
    fromImage = reading.fromImage;
    // Contratos, estudios de otra comercializadora o facturas de otra tarifa:
    // se dice qué es antes de anonimizar y de gastar en la IA.
    const notInvoice = notAnInvoice(reading.text, { fromImage });
    if (notInvoice) throw new StudyError(notInvoice.message);
    // Datos del titular leídos en local: rellenan el cliente y, además, se
    // tapan en todo el texto aunque no lleven etiqueta.
    const redacted = redactInvoiceForStudy(reading.text, { fromImage });
    if (redacted.redaction.leaks.length > 0) {
      throw new StudyError(
        "No se ha podido tapar todos los datos personales de esta factura, así que no se envía a analizar. Avisa a soporte con la comparativa.",
      );
    }
    clientData = redacted.clientData;
    const found = redacted.redaction.identifiers.cups[0] ?? invoice.cups ?? null;
    // Sin un año real de consumo del SIPS no hay estudio. Se comprueba antes
    // de llamar a la IA: no se gasta en una factura que no se puede comparar.
    if (!found) {
      throw new StudyError(fromImage ? SIPS_MESSAGES.noCupsInImage : SIPS_MESSAGES.noCups, 422, "cups_missing");
    }
    cups = found;
    sips = await loadSipsYear(fetchSips, cups);
    extraction = await extract({ file: { text: redacted.redaction.text }, context, knownCups: cups });
    facts = extraction.extraction.supplierName
      ? extraction.extraction
      : { ...extraction.extraction, supplierName: await supplierFromText(client, redacted.redaction.text) };
    const check = await verify({
      text: redacted.redaction.text,
      reading: facts,
      context: { ...context, jobType: "invoice_verification" },
    });
    if (check?.notInvoice) throw new StudyError(NOT_INVOICE_MESSAGES[check.notInvoice]);
    doubtful = (check?.doubtfulFields ?? []).map((field) => ({ code: "doubtful_reading", severity: "warning", field }));
  }
  const { sipsPoint, sipsConsumption } = sips;
  const aiCostUsd = extraction.attempts.reduce((sum, { costUsd }) => sum + (costUsd ?? 0), 0);

  const tariff = (facts.accessTariff ?? "").replace(/\s/g, "").toUpperCase();
  if (tariff && !tariff.startsWith("2.0")) {
    throw new StudyError(`El comparador propio compara 2.0TD; esta factura es ${facts.accessTariff}.`);
  }

  let supply;
  try {
    supply = buildSupply({ invoice: facts, sipsPoint, sipsConsumption });
  } catch (error) {
    if (error instanceof SupplyUnavailableError) throw new StudyError(error.message);
    throw error;
  }

  const studyId = await createStudy(client, {
    comparativaId,
    status: "analyzed",
    invoiceFileId: invoice.fileId,
    invoiceFileName: invoice.fileName,
    cups,
    extraction: facts,
    issues: [
      ...(fromImage ? [{ code: "read_from_image" as const, severity: "warning" as const, field: "invoice" }] : []),
      ...extraction.issues,
      ...doubtful,
    ],
    supply,
    // El tipo de tarifa (fija, indexada, plana) lo confirma quien hace el estudio.
    options: { channel, feeEnergyPerMwh: null, order: "savings" },
    priceDate: today,
    aiCostUsd,
    error: null,
    // Leídos en local del texto sin tapar: nunca han salido del CRM.
    clientData,
    createdBy: userId,
  });
  // Indexada: el mercado (OMIE) se descarga ya, para que el estudio se abra sin esperar.
  if (facts.pricing === "indexed") {
    const study = await getStudy(client, studyId);
    if (study) await ensureMarket(client, study);
  }
  return studyId;
}

/** Particular o empresa según el titular de la factura; autónomo solo si se marca. */
export function customerTypeFromClient(client: StudyClientData | null): CustomerType | null {
  if (client?.kind === "Particular") return "particular";
  if (client?.kind === "Empresa") return "empresa";
  return null;
}

/** La comercializadora de la factura buscada en su texto, entre las del tenant. */
async function supplierFromText(client: TenantClient, text: string): Promise<string | null> {
  const { rows } = await client.execute("SELECT id, name FROM comercializadoras");
  const suppliers = rows.map((row) => ({ id: String(row.id), name: String(row.name ?? "") }));
  return detectSupplierInText(text, suppliers)?.name ?? null;
}

/**
 * Las ofertas llevan el mismo impuesto y tipo que la factura del cliente
 * (Canarias, Ceuta y Melilla, IVA reducido…), como hace Beenergy.
 */
function withInvoiceTaxes(
  regulated: RegulatedParams,
  rates: { electricityTaxRate?: number; vatRate?: number },
): RegulatedParams {
  // Un tipo impreso con menos decimales (5,112696 %) no cambia el general.
  const pick = (fromInvoice: number | undefined, general: number) =>
    fromInvoice !== undefined && Math.abs(fromInvoice - general) > 0.0001 ? fromInvoice : general;
  return {
    ...regulated,
    electricityTaxRate: pick(rates.electricityTaxRate, regulated.electricityTaxRate),
    vatRate: pick(rates.vatRate, regulated.vatRate),
  };
}

/** Cómo es la tarifa de hoy: la que marca quien hace el estudio o, si no, la que leyó la IA. */
export function currentPricingOf(study: Pick<StudyRecord, "extraction">, options: Pick<SavedStudyOptions, "currentPricing">): CurrentPricing {
  if (options.currentPricing) return options.currentPricing;
  const read = study.extraction?.pricing;
  return read === "indexed" || read === "flat" ? read : "fixed";
}

/** Lo que paga hoy y cómo se ha calculado, para enseñarlo. */
export interface CurrentInfo {
  pricing: CurrentPricing;
  /** Lo que la IA leyó en la factura, para avisar si quien hace el estudio lo cambia. */
  readPricing: InvoiceExtraction["pricing"] | null;
  /** Indexada: €/kWh por encima del OMIE que cobra su factura (peajes, cargos y margen). */
  marginOverMarket: number | null;
  /** Indexada: media de OMIE de sus 12 meses de consumo, en €/MWh. */
  marketAverage: number | null;
  /** Por qué no se sabe lo que paga hoy, si no se sabe. */
  unavailable: string | null;
}

const MARKET_MESSAGES = {
  noReadings: "Este estudio se analizó antes de guardar las lecturas del SIPS: vuelve a analizar la factura para compararla con el mercado.",
  noPeriod: "La factura no tiene periodo de facturación: hace falta para compararla con el mercado.",
  unavailable: "No se han podido descargar los precios de OMIE. Vuelve a intentarlo en unos minutos.",
};

/**
 * El mercado (OMIE) de las lecturas del SIPS y de la factura, para comparar
 * una tarifa indexada. Se calcula una vez y se guarda en el suministro; se
 * repite si la revisión de la factura cambia su periodo.
 */
export async function ensureMarket(
  client: TenantClient,
  study: StudyRecord,
  fetchDay?: OmieDayFetcher,
): Promise<{ supply: StudySupply; error: string | null }> {
  const supply = study.supply!;
  const period = study.extraction?.billingPeriod;
  if (!supply.readings?.length) return { supply, error: MARKET_MESSAGES.noReadings };
  if (!period?.from || !period.to) return { supply, error: MARKET_MESSAGES.noPeriod };
  const invoicePeriod = { from: period.from, to: period.to };
  const market = supply.market;
  if (market && market.invoicePeriod.from === invoicePeriod.from && market.invoicePeriod.to === invoicePeriod.to) {
    return { supply, error: null };
  }
  try {
    const averages = await omieAverages([...supply.readings, invoicePeriod], fetchDay);
    const next: StudySupply = {
      ...supply,
      market: {
        source: "omie",
        readings: averages.slice(0, -1),
        invoice: averages.at(-1)!,
        invoicePeriod,
        fetchedAt: new Date().toISOString(),
      },
    };
    await saveStudySupply(client, study.id, next);
    return { supply: next, error: null };
  } catch (error) {
    console.error("[comparador] OMIE prices", error);
    return { supply, error: MARKET_MESSAGES.unavailable };
  }
}

/** Lo que paga hoy, según el tipo de tarifa. */
async function resolveCurrent(
  client: TenantClient,
  study: StudyRecord,
  pricing: CurrentPricing,
): Promise<{ tariff: CurrentTariff | null; supply: StudySupply; info: CurrentInfo }> {
  const extraction = study.extraction!;
  const info: CurrentInfo = {
    pricing,
    readPricing: extraction.pricing ?? null,
    marginOverMarket: null,
    marketAverage: null,
    unavailable: null,
  };
  let supply = study.supply!;
  // Sin lo que paga hoy hasta que alguien revise una lectura que no cuadra.
  if (needsInvoiceReview(study)) return { tariff: null, supply, info };

  if (pricing === "flat") {
    const tariff = flatTariffFromInvoice(extraction);
    if (!tariff) info.unavailable = "La factura no trae la base imponible ni el periodo, que dan la cuota de la tarifa plana: revísala.";
    return { tariff, supply, info };
  }

  const tariff = currentTariffFromInvoice(extraction);
  if (pricing === "fixed" || !tariff) return { tariff, supply, info };

  const market = await ensureMarket(client, study);
  supply = market.supply;
  if (market.error) return { tariff: null, supply, info: { ...info, unavailable: market.error } };
  const energy = indexedEnergyPrices(tariff.prices.energy, supply);
  if (!energy) return { tariff: null, supply, info: { ...info, unavailable: MARKET_MESSAGES.noReadings } };
  const readings = supply.readings ?? [];
  const totalKwh = readings.reduce((sum, { kwh }) => sum + kwh.P1 + kwh.P2 + kwh.P3, 0);
  // Sin consumo por periodo en la factura (foto, OCR), pesa el del año del SIPS.
  const invoiceKwh = extraction.consumptionKwh;
  const hasInvoiceKwh = (invoiceKwh.P1 ?? 0) + (invoiceKwh.P2 ?? 0) + (invoiceKwh.P3 ?? 0) > 0;
  info.marginOverMarket = marginOverMarket(tariff.prices.energy, supply, hasInvoiceKwh ? invoiceKwh : supply.annualKwh);
  info.marketAverage =
    totalKwh > 0
      ? readings.reduce(
          (sum, { kwh }, index) =>
            sum + (["P1", "P2", "P3"] as const).reduce((part, period) => part + kwh[period] * supply.market!.readings[index][period], 0),
          0,
        ) / totalKwh
      : null;
  return { tariff: { ...tariff, prices: { ...tariff.prices, energy } }, supply, info };
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
}): Promise<{
  ranking: StudyRanking;
  options: SavedStudyOptions;
  current: CurrentTariff | null;
  currentInfo: CurrentInfo;
  supply: StudySupply;
  /** SSAA con los que se ha calculado (null, sin aplicar) y los que propone el tenant. */
  ancillary: { value: AncillarySimulation | null; suggested: AncillarySimulation | null };
  /** Tipo de cliente con el que se oferta y el que se dedujo del NIF o CIF de la factura. */
  customerType: { value: CustomerType | null; detected: CustomerType | null };
}> {
  if (!study.extraction || !study.supply) {
    throw new StudyError("Este estudio no tiene factura analizada.", 409);
  }
  const effective: SavedStudyOptions = { ...study.options, ...options };
  const pricing = currentPricingOf(study, effective);
  const [offers, rules, suggested, current] = await Promise.all([
    listActiveOfferPrices(client, study.priceDate),
    listCurrentCommissionRules(client, study.priceDate),
    getDefaultAncillary(client),
    resolveCurrent(client, study, pricing),
  ]);
  // Los SSAA solo cuentan si el estudio los aplica; los del tenant son la propuesta.
  const ancillary = { value: effective.ancillary ?? null, suggested };
  // El que se marca en el estudio; si no, el de la factura (NIF: particular; CIF: empresa).
  const detected = customerTypeFromClient(study.clientData);
  const customerType = { value: effective.customerType ?? detected, detected };
  const ranking = rankStudy({
    supply: current.supply,
    current: current.tariff,
    offers,
    rules,
    regulated: withInvoiceTaxes(getRegulatedParams(study.priceDate), invoiceTaxRates(study.extraction)),
    options: { ...effective, customerType: customerType.value, ancillary: ancillary.value, date: study.priceDate },
  });
  return {
    ranking,
    options: effective,
    current: current.tariff,
    currentInfo: current.info,
    supply: current.supply,
    ancillary,
    customerType,
  };
}
