import type { Client } from "@libsql/client";
import { getRegulatedParams, type RegulatedParams } from "@/comparador/engine/regulated";
import { extractGasInvoice } from "@/comparador/gas/extract";
import { gasCurrentTariff, gasInvoiceTaxRates, gasReadingOf, type GasStudyExtraction } from "@/comparador/gas/invoice";
import { getGasRegulatedParams, type GasRegulatedParams } from "@/comparador/gas/regulated";
import { buildEstimatedGasSupply, buildGasSupply, gasReadingsFromSips } from "@/comparador/gas/supply";
import {
  currentTariffFromInvoice,
  flatTariffFromInvoice,
  invoiceTaxRates,
  type CurrentTariff,
} from "@/comparador/extraction/current-tariff";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import { omieAverages, type OmieDayFetcher } from "@/comparador/market/omie";
import { listIndexHistory } from "@/comparador/rates/index-history";
import { NOT_INVOICE_MESSAGES, notAnInvoice, otherEnergyByTariff } from "@/comparador/extraction/document-kind";
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
  ApoloSipsGasConsumptionRow,
  ApoloSipsGasPointSupplyRow,
  ApoloSipsProcedure,
  ApoloSipsProcedureResult,
  ApoloSipsProcedureRow,
  ApoloSipsSupplyType,
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
import { getDefaultAncillary, getFeePolicies } from "./settings";
import { detectSupplierInText } from "./supplier";
import {
  annualKwhFromSips,
  buildEstimatedSupply,
  buildSupply,
  SIPS_MESSAGES,
  SupplyUnavailableError,
  type SipsYear as SipsConsumptionYear,
  type StudySupply,
} from "./supply";

type TenantClient = Pick<Client, "execute" | "batch">;

export { StudyError };

/** Consulta al SIPS de luz o de gas; null si no se puede (sin clave, caído, CUPS desconocido). */
export type SipsFetcher = (
  cups: string,
  procedure: ApoloSipsProcedure,
  supplyType?: ApoloSipsSupplyType,
) => Promise<ApoloSipsProcedureResult<ApoloSipsProcedureRow> | null>;

/** Luz o gas: lo que compara la comparativa. */
export type StudyEnergy = "electricity" | "gas";

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

interface SipsData {
  sipsPoint: ApoloSipsElectricityPointSupplyRow | ApoloSipsGasPointSupplyRow | null;
  sipsConsumption: ApoloSipsElectricityConsumptionRow[] | ApoloSipsGasConsumptionRow[];
  /** El año de consumo del SIPS, completo o no; null sin lecturas. */
  year: SipsConsumptionYear | null;
}

const NO_SIPS: SipsData = { sipsPoint: null, sipsConsumption: [], year: null };

/**
 * El punto de suministro y el consumo del SIPS. Si no responde y el estudio
 * lo necesita, se para (es pasajero); sin un año de lecturas el estudio
 * estima con la factura. En un «Estudio sin SIPS» se consulta igual, para las
 * comisiones, pero sin parar si falla.
 */
async function loadSips(fetchSips: SipsFetcher, cups: string | null, energy: StudyEnergy, required: boolean): Promise<SipsData> {
  if (!cups) return NO_SIPS;
  const supplyType = energy === "gas" ? "GAS" : "ELECTRICIDAD";
  const [point, consumption] = await Promise.all([
    fetchSips(cups, "PS", supplyType).catch(() => null),
    fetchSips(cups, "CONSUMOS", supplyType).catch(() => null),
  ]);
  if (!consumption) {
    if (required) throw new StudyError(SIPS_MESSAGES.unavailable, 503);
    return NO_SIPS;
  }
  const readings =
    energy === "gas"
      ? gasReadingsFromSips(consumption.rows as ApoloSipsGasConsumptionRow[])
      : (consumption.rows as ApoloSipsElectricityConsumptionRow[]);
  return {
    sipsPoint: (point?.rows[0] as ApoloSipsElectricityPointSupplyRow | ApoloSipsGasPointSupplyRow | undefined) ?? null,
    sipsConsumption: consumption.rows as ApoloSipsElectricityConsumptionRow[] | ApoloSipsGasConsumptionRow[],
    year: annualKwhFromSips(readings),
  };
}

/** La foto de gas se ha leído, pero sin el término fijo ni el variable. */
const NO_GAS_DETAIL_IN_PHOTO =
  "No se ha podido leer el detalle de la factura de gas (término fijo y variable) en la foto. Si tiene más páginas, súbelas todas; si no, haz otra foto de frente y con buena luz, o pide el PDF.";

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
  energy = "electricity",
  useSips = true,
  extract = extractInvoice,
  extractGas = extractGasInvoice,
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
  /** Luz (por defecto) o gas, según la comparativa. */
  energy?: StudyEnergy;
  /**
   * false: «Estudio sin SIPS». El consumo sale de la factura llevada a un año
   * (una estimación) y el SIPS solo se consulta, si hay CUPS, para las comisiones.
   */
  useSips?: boolean;
  extract?: typeof extractInvoice;
  extractGas?: typeof extractGasInvoice;
  verify?: typeof verifyReading;
}): Promise<string> {
  const context = { tenantSlug, jobType: "invoice_extraction" as const, userId, subjectId: comparativaId };
  const images = photoVisionEnabled() ? await invoiceImagesForVision(invoice) : null;

  let cups: string | null;
  let fromImage: boolean;
  let clientData: StudyClientData | null;
  let extraction: { extraction: InvoiceExtraction; issues: InvoiceIssue[]; attempts: { costUsd: number | null }[] };
  const gas = energy === "gas";
  /** Lee la factura con el extractor de luz o el de gas. */
  const read = (file: Parameters<typeof extractInvoice>[0]["file"], knownCups: string | null) =>
    gas ? extractGas({ file, context, knownCups }) : extract({ file, context, knownCups });
  let sips: SipsData;
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
    extraction = await read({ pages: images, zoomed: await zoomedBands(images) }, invoice.cups ?? null);
    const reading = extraction.extraction;
    // Una foto de la otra energía se ve en el peaje que ha leído la IA.
    const wrongEnergy = otherEnergyByTariff(reading.accessTariff, energy);
    if (wrongEnergy) throw new StudyError(wrongEnergy.message, 422, "other_energy");
    const gasReading = gasReadingOf(reading);
    if (gasReading) {
      if (gasReading.fixedTermLines.length === 0 && gasReading.energyLines.length === 0 && gasReading.pricing !== "flat") {
        throw new StudyError(NO_GAS_DETAIL_IN_PHOTO);
      }
    } else if (reading.powerLines.length === 0 && reading.energyLines.length === 0) throw new StudyError(NO_DETAIL_IN_PHOTO);
    const readCups = reading.cups && isValidCups(reading.cups) ? normalizeIdentifier(reading.cups) : null;
    const found = invoice.cups ?? readCups;
    if (!found && useSips) throw new StudyError(SIPS_MESSAGES.noCupsInImage, 422, "cups_missing");
    cups = found;
    clientData = clientFromExtraction(reading);
    sips = await loadSips(fetchSips, cups, energy, useSips);
    facts = reading;
  } else {
    const reading = await readInvoice(invoice);
    fromImage = reading.fromImage;
    // Contratos, estudios de otra comercializadora o facturas de otra tarifa:
    // se dice qué es antes de anonimizar y de gastar en la IA.
    const notInvoice = notAnInvoice(reading.text, { fromImage, energy });
    if (notInvoice) throw new StudyError(notInvoice.message, 422, notInvoice.kind === "other_energy" ? "other_energy" : undefined);
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
    // Sin CUPS no hay SIPS: se pide antes de llamar a la IA, salvo en un
    // «Estudio sin SIPS», que puede seguir sin él.
    if (!found && useSips) {
      throw new StudyError(fromImage ? SIPS_MESSAGES.noCupsInImage : SIPS_MESSAGES.noCups, 422, "cups_missing");
    }
    cups = found;
    sips = await loadSips(fetchSips, cups, energy, useSips);
    extraction = await read({ text: redacted.redaction.text }, cups);
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

  // El texto puede traer de las dos (luz y gas juntas) y el peaje leído decide.
  const wrongEnergy = otherEnergyByTariff(facts.accessTariff, energy);
  if (wrongEnergy) throw new StudyError(wrongEnergy.message, 422, "other_energy");
  const tariff = (facts.accessTariff ?? "").replace(/\s/g, "").toUpperCase();
  if (!gas && tariff && !tariff.startsWith("2.0")) {
    throw new StudyError(`El comparador propio compara 2.0TD; esta factura es ${facts.accessTariff}.`);
  }
  if (gas && extraction.issues.some(({ code }) => code === "unsupported_gas_tariff")) {
    throw new StudyError(`El comparador compara gas de RL.1 a RL.4; esta factura es ${facts.accessTariff}.`);
  }

  // Con un año de SIPS, el consumo real. Si no hay año (alta nueva, pocas
  // lecturas) o se ha pedido «Estudio sin SIPS», la factura llevada a un año,
  // avisando de que es una estimación (Beenergy, 15-10-2026). El consumo real
  // del SIPS, si lo hay, sigue mandando en las comisiones.
  const fullYear = sips.year && !("insufficient" in sips.year) ? sips.year : null;
  const estimated = !useSips || !fullYear;
  const referenceAnnualKwh = fullYear ? fullYear.annualKwh.P1 + fullYear.annualKwh.P2 + fullYear.annualKwh.P3 : null;
  let supply;
  try {
    supply = estimated
      ? gas
        ? buildEstimatedGasSupply({
            invoice: facts,
            sipsPoint: sipsPoint as ApoloSipsGasPointSupplyRow | null,
            reason: useSips ? "no_sips" : "chosen",
            referenceAnnualKwh,
          })
        : buildEstimatedSupply({
            invoice: facts,
            sipsPoint: sipsPoint as ApoloSipsElectricityPointSupplyRow | null,
            reason: useSips ? "no_sips" : "chosen",
            referenceAnnualKwh,
          })
      : gas
      ? buildGasSupply({
          invoice: facts,
          sipsPoint: sipsPoint as ApoloSipsGasPointSupplyRow | null,
          sipsConsumption: sipsConsumption as ApoloSipsGasConsumptionRow[],
        })
      : buildSupply({
          invoice: facts,
          sipsPoint: sipsPoint as ApoloSipsElectricityPointSupplyRow | null,
          sipsConsumption: sipsConsumption as ApoloSipsElectricityConsumptionRow[],
        });
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
      ...(estimated ? [{ code: "estimated_consumption" as const, severity: "warning" as const, field: "consumptionKwh" }] : []),
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
  if (facts.pricing === "indexed" && !gas) {
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

/** Gas: el impuesto de hidrocarburos y el IVA de la factura, si cuadran. */
function withGasInvoiceTaxes(
  regulated: GasRegulatedParams,
  rates: { hydrocarbonTaxPerKwh?: number; vatRate?: number },
): GasRegulatedParams {
  return {
    hydrocarbonTaxPerKwh: rates.hydrocarbonTaxPerKwh ?? regulated.hydrocarbonTaxPerKwh,
    vatRate: rates.vatRate ?? regulated.vatRate,
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
  /** Gas indexado: lo que paga hoy se ha calculado con el precio de esta factura todo el año. */
  gasIndexedFromInvoice?: boolean;
}

const MARKET_MESSAGES = {
  noReadings: "Este estudio se analizó antes de guardar las lecturas del SIPS: vuelve a analizar la factura para compararla con el mercado.",
  estimated:
    "Con el consumo estimado (sin las lecturas del SIPS) no se puede comparar una tarifa indexada con el mercado de cada mes: márcala como fija para usar el precio de esta factura.",
  noPeriod: "La factura no tiene periodo de facturación: hace falta para compararla con el mercado.",
  unavailable: "No se han podido descargar los precios de OMIE. Vuelve a intentarlo en unos minutos.",
};

/**
 * El mercado (OMIE) de las lecturas del SIPS y de la factura, para comparar
 * una tarifa indexada. Se calcula una vez y se guarda en el suministro; se
 * repite si la revisión de la factura cambia su periodo, y en los estudios
 * calculados antes de ponderar por el perfil de REE.
 */
export async function ensureMarket(
  client: TenantClient,
  study: StudyRecord,
  fetchDay?: OmieDayFetcher,
): Promise<{ supply: StudySupply; error: string | null }> {
  const supply = study.supply!;
  const period = study.extraction?.billingPeriod;
  if (!supply.readings?.length) return { supply, error: supply.estimate ? MARKET_MESSAGES.estimated : MARKET_MESSAGES.noReadings };
  if (!period?.from || !period.to) return { supply, error: MARKET_MESSAGES.noPeriod };
  const invoicePeriod = { from: period.from, to: period.to };
  const market = supply.market;
  if (
    market?.weighting === "ree_profile" &&
    market.invoicePeriod.from === invoicePeriod.from &&
    market.invoicePeriod.to === invoicePeriod.to
  ) {
    return { supply, error: null };
  }
  try {
    const averages = await omieAverages([...supply.readings, invoicePeriod], fetchDay);
    const next: StudySupply = {
      ...supply,
      market: {
        source: "omie",
        weighting: "ree_profile",
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

  // Gas: los precios de su factura. Una indexada se toma con el precio de
  // esta factura todo el año (el mercado del gas, MIBGAS, aún no se descarga).
  if (supply.energy === "gas") {
    const gasExtraction = gasReadingOf(extraction) ? (extraction as GasStudyExtraction) : null;
    const tariff = gasExtraction ? gasCurrentTariff(gasExtraction) : null;
    const reading = gasExtraction?.gas;
    if (!tariff) {
      info.unavailable =
        reading && (reading.consumptionKwh ?? 0) === 0 && reading.energyLines.length === 0
          ? "Esta factura de gas no tiene consumo y no dice a cuánto cobra el kWh: analiza otra factura del cliente con consumo."
          : "La factura de gas no da todos sus precios (término fijo y variable): revísala.";
    }
    if (tariff && pricing === "indexed") {
      info.unavailable = null;
      info.gasIndexedFromInvoice = true;
    }
    return { tariff, supply, info };
  }

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
  const gas = study.supply.energy === "gas";
  const [offers, rules, suggested, current, indexHistory, feePolicies] = await Promise.all([
    listActiveOfferPrices(client, study.priceDate, gas ? "gas" : "electricity"),
    listCurrentCommissionRules(client, study.priceDate),
    getDefaultAncillary(client),
    resolveCurrent(client, study, pricing),
    listIndexHistory(client),
    getFeePolicies(client),
  ]);
  // Los SSAA solo cuentan si el estudio los aplica; los del tenant son la propuesta.
  const ancillary = { value: effective.ancillary ?? null, suggested };
  // El que se marca en el estudio; si no, el de la factura (NIF: particular; CIF: empresa).
  const detected = customerTypeFromClient(study.clientData);
  const customerType = { value: effective.customerType ?? detected, detected };
  const gasReading = gas ? gasReadingOf(study.extraction) : null;
  const ranking = rankStudy({
    supply: current.supply,
    current: current.tariff,
    offers,
    rules,
    regulated: withInvoiceTaxes(getRegulatedParams(study.priceDate), invoiceTaxRates(study.extraction)),
    gasRegulated: gas ? withGasInvoiceTaxes(getGasRegulatedParams(study.priceDate), gasReading ? gasInvoiceTaxRates(gasReading) : {}) : undefined,
    options: { ...effective, customerType: customerType.value, ancillary: gas ? null : ancillary.value, date: study.priceDate },
    indexHistory,
    feePolicies,
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
