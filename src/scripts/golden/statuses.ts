import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import { isValidCups } from "@/comparador/extraction/identifiers";
import { validateInvoice } from "@/comparador/extraction/validate";

/**
 * - `verified`: confirmado por una fuente que no depende de quien leyó la
 *   factura (aritmética, SIPS, dígito de control, lectura local sin IA).
 * - `unverified`: solo lo ha leído quien preparó la ficha; lo mira una persona.
 * - `error`: no cuadra; hay que corregirlo.
 * - `confirmed`: lo ha confirmado la persona que revisa.
 */
export type FieldStatus = "verified" | "unverified" | "error" | "confirmed";

export interface SipsCheck {
  consumption: { P1: boolean; P2: boolean; P3: boolean } | null;
  contractedPower: boolean | null;
}

export interface StatusInput {
  ficha: InvoiceExtraction;
  redactedText: string;
  supplierGuess: string;
  privateCups: string[];
  sips: SipsCheck | null;
  confirmedFields: readonly string[];
  /** Lecturas de otro modelo: un campo en el que coinciden queda verificado. */
  otherReadings?: readonly InvoiceExtraction[];
  /** Campos que la comprobación independiente (Jev) no ve en la factura. */
  doubtful?: readonly string[];
  /** La comercializadora imprime el CUPS tapado («CUPS: *»): se pide a mano. */
  cupsMasked?: boolean;
}

/**
 * No entran en el cálculo: si no se pueden verificar solos, no se piden a
 * mano. (El tipo de precio tampoco: no decide qué se oferta.)
 */
const INFORMATIVE_FIELDS = ["supplierName", "issueDate", "billingPeriod.dates"];

/** Campos que se copian del texto y en los que dos modelos distintos pueden coincidir. */
const AGREEMENT_FIELDS: Record<string, (invoice: InvoiceExtraction) => unknown> = {
  // Sin la forma jurídica ni palabras genéricas: «Endesa Energía, S.A.U.» = «ENDESA ENERGIA».
  supplierName: (invoice) =>
    invoice.supplierName
      ? normalize(invoice.supplierName)
          .split(/[^a-z0-9]+/)
          .filter((word) => word.length >= 3 && !/^(sau|slu|sl|sa|energia|comercializadora|clientes|espana|iberia)$/.test(word))
          .join(" ") || undefined
      : undefined,
  hasSelfConsumption: (invoice) => invoice.hasSelfConsumption,
  issueDate: (invoice) => invoice.issueDate ?? undefined,
  "billingPeriod.dates": (invoice) =>
    invoice.billingPeriod?.from && invoice.billingPeriod.to ? `${invoice.billingPeriod.from}|${invoice.billingPeriod.to}` : undefined,
  "billingPeriod.days": (invoice) => invoice.billingPeriod?.days ?? undefined,
  "consumptionKwh.P1": (invoice) => invoice.consumptionKwh.P1 ?? undefined,
  "consumptionKwh.P2": (invoice) => invoice.consumptionKwh.P2 ?? undefined,
  "consumptionKwh.P3": (invoice) => invoice.consumptionKwh.P3 ?? undefined,
};

/** Fallos en las bases: si las bases no cuadran, ninguna línea está confirmada. */
const CHAIN_ISSUES = new Set([
  "electricity_tax_base_mismatch",
  "taxable_base_mismatch",
]);

function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

/** Una cifra tal como la escriben las facturas: «1.234,5», «73», «0,1099». */
function appearsInText(value: number | null, text: string): boolean {
  if (value === null) return false;
  const [integer, decimals = ""] = Math.abs(value).toString().split(".");
  const thousands = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "[.]?");
  const decimal = decimals ? `[,.]${decimals}0*` : "(?:[,.]0+)?";
  return new RegExp(`(?<![\\d,.])-?${thousands}${decimal}(?![\\d])`).test(text);
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** La fecha de la ficha (YYYY-MM-DD) escrita en la factura: «05/10/2026», «5 de octubre de 2026». */
function dateInText(date: string | null, text: string): boolean {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match;
  const d = String(Number(day));
  const m = String(Number(month));
  return (
    new RegExp(`(?<!\\d)0?${d}[/.-]0?${m}[/.-](?:${year}|${year.slice(2)})(?!\\d)`).test(text) ||
    new RegExp(`(?<!\\d)0?${d} de ${MONTHS[Number(month) - 1]}(?: de)? ${year}`, "i").test(text)
  );
}


const normalize = (value: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function computeFieldStatuses({
  ficha,
  redactedText,
  supplierGuess,
  privateCups,
  sips,
  confirmedFields,
  otherReadings = [],
  doubtful = [],
  cupsMasked = false,
}: StatusInput): Record<string, FieldStatus> {
  const issues = validateInvoice({ ...ficha, cups: privateCups[0] ?? ficha.cups });
  const issueFields = new Set(issues.map(({ field }) => field));
  const chainBroken = issues.some(({ code }) => CHAIN_ISSUES.has(code));
  const statuses: Record<string, FieldStatus> = {};

  const lineStatus = (field: string): FieldStatus =>
    issueFields.has(field) ? "error" : chainBroken ? "unverified" : "verified";

  ficha.powerLines.forEach((_, index) => {
    statuses[`powerLines.${index}`] = lineStatus(`powerLines[${index}]`);
  });
  ficha.energyLines.forEach((_, index) => {
    statuses[`energyLines.${index}`] = lineStatus(`energyLines[${index}]`);
  });
  ficha.socialBonusLines.forEach((_, index) => {
    statuses[`socialBonusLines.${index}`] = lineStatus(`socialBonusLines[${index}]`);
  });
  ficha.energyDiscounts.forEach((_, index) => {
    statuses[`energyDiscounts.${index}`] = chainBroken ? "unverified" : "verified";
  });
  ficha.otherElectricityLines.forEach((_, index) => {
    statuses[`otherElectricityLines.${index}`] = chainBroken ? "unverified" : "verified";
  });
  ficha.vatExemptLines.forEach((_, index) => {
    statuses[`vatExemptLines.${index}`] = issueFields.has("total") ? "unverified" : "verified";
  });
  ficha.otherTaxableLines.forEach((_, index) => {
    statuses[`otherTaxableLines.${index}`] = chainBroken ? "unverified" : "verified";
  });
  statuses.meterRental = lineStatus("meterRental");

  statuses.electricityTax = issueFields.has("electricityTax.amount") ||
    issueFields.has("electricityTax.base")
    ? "error"
    : "verified";
  statuses.vat = issueFields.has("vat.amount") || issueFields.has("vat.base")
    ? "error"
    : "verified";
  statuses.total = issueFields.has("total") ? "error" : "verified";

  // La potencia queda confirmada por la aritmética de sus líneas o por el SIPS.
  for (const period of ["P1", "P2"] as const) {
    const value = ficha.contractedKw[period];
    const lines = ficha.powerLines.filter((line) => line.period === period);
    const matchesLines =
      value !== null &&
      lines.length > 0 &&
      lines.every((line) => line.kw === value) &&
      !chainBroken &&
      lines.every((_, i) => !issueFields.has(`powerLines[${i}]`));
    statuses[`contractedKw.${period}`] =
      value === null
        ? "error"
        : matchesLines || sips?.contractedPower
          ? "verified"
          : "unverified";
  }

  // El reparto por periodos lo confirma el SIPS o la propia factura: cada
  // consumo escrito en ella y, entre los tres, los kWh que ya cuadran con el
  // importe de la energía.
  const consumptionError = issueFields.has("consumptionKwh");
  const { P1, P2, P3 } = ficha.consumptionKwh;
  const energyKwh = new Set(
    ["P1", "P2", "P3", "ALL"].map((period) =>
      ficha.energyLines.filter((line) => line.period === period).reduce((max, line) => Math.max(max, line.kwh), 0),
    ),
  );
  const billedKwh = ficha.energyLines.some((line) => line.period === "ALL")
    ? Math.max(...ficha.energyLines.filter((line) => line.period === "ALL").map((line) => line.kwh))
    : [...energyKwh].reduce((sum, value) => sum + value, 0);
  const splitInText =
    !chainBroken &&
    [P1, P2, P3].every((value) => value === 0 || appearsInText(value, redactedText)) &&
    Math.abs((P1 ?? 0) + (P2 ?? 0) + (P3 ?? 0) - billedKwh) <= 1;
  for (const period of ["P1", "P2", "P3"] as const) {
    statuses[`consumptionKwh.${period}`] = consumptionError
      ? "error"
      : sips?.consumption?.[period] || splitInText
        ? "verified"
        : "unverified";
  }

  const days = ficha.billingPeriod?.days ?? null;
  const powerDays = new Set(ficha.powerLines.map((line) => line.days));
  const linesDays = [...powerDays].reduce((sum, value) => sum + value, 0);
  // Lo que se cobra por día (alquiler, bono social) cuadra con su importe: sus días valen.
  const dailyDays = [
    issueFields.has("meterRental") ? null : ficha.meterRental?.days,
    ...ficha.socialBonusLines.map((line, index) => (issueFields.has(`socialBonusLines[${index}]`) ? null : line.days)),
  ].filter((value): value is number => typeof value === "number");
  statuses["billingPeriod.days"] =
    days === null
      ? "error"
      : (days === linesDays || dailyDays.includes(days)) && !chainBroken
        ? "verified"
        : "unverified";
  const span = ficha.billingPeriod
    ? daysBetween(ficha.billingPeriod.from, ficha.billingPeriod.to)
    : null;
  statuses["billingPeriod.dates"] =
    span !== null && days !== null && (span === days || span + 1 === days)
      ? "verified"
      : "unverified";

  statuses.accessTariff = ficha.accessTariff === "2.0TD" ? "verified" : "unverified";
  const supplierWords = normalize(ficha.supplierName)
    .split(/[\s,.]+/)
    .filter((word) => word.length >= 4 && !/^(energia|comercializadora|clientes|s\.?a\.?u?)$/.test(word));
  statuses.supplierName =
    (supplierGuess !== "otra" &&
      normalize(ficha.supplierName).includes(normalize(supplierGuess).split(" ")[0])) ||
    (supplierWords.length > 0 && supplierWords.every((word) => normalize(redactedText).includes(word)))
      ? "verified"
      : "unverified";
  // El tipo de precio no se revisa: no decide qué se oferta (se ofertan fijo e
  // indexado) y lo confirma quien hace el estudio.
  statuses.hasSelfConsumption =
    !ficha.hasSelfConsumption && !/autoconsumo|excedente/i.test(redactedText)
      ? "verified"
      : "unverified";
  statuses.issueDate = dateInText(ficha.issueDate, redactedText) ? "verified" : "unverified";
  statuses.cups = privateCups.some(isValidCups) ? "verified" : "error";

  // Dos modelos que leen lo mismo del mismo texto: verificado. Una lectura
  // idéntica a la ficha entera es la misma, no cuenta.
  const independent = otherReadings.filter((reading) => JSON.stringify(reading) !== JSON.stringify(ficha));
  for (const [field, valueOf] of Object.entries(AGREEMENT_FIELDS)) {
    const value = valueOf(ficha);
    if (statuses[field] !== "unverified" || value === undefined) continue;
    if (independent.some((reading) => valueOf(reading) === value)) statuses[field] = "verified";
  }

  // Lo que Jev no ve en la factura vuelve a revisión, aunque cuadre con otra cosa.
  for (const field of doubtful) {
    if (statuses[field] === "verified") statuses[field] = "unverified";
  }

  for (const field of INFORMATIVE_FIELDS) {
    if (statuses[field] === "unverified") delete statuses[field];
  }
  if (cupsMasked) delete statuses.cups;

  for (const field of confirmedFields) {
    if (statuses[field] === "unverified") statuses[field] = "confirmed";
  }
  return statuses;
}
