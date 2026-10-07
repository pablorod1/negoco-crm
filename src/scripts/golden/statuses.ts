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
}

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

  // El reparto por periodos solo lo confirma el SIPS.
  const consumptionError = issueFields.has("consumptionKwh");
  for (const period of ["P1", "P2", "P3"] as const) {
    statuses[`consumptionKwh.${period}`] = consumptionError
      ? "error"
      : sips?.consumption?.[period]
        ? "verified"
        : "unverified";
  }

  const days = ficha.billingPeriod?.days ?? null;
  const powerDays = new Set(ficha.powerLines.map((line) => line.days));
  const linesDays = [...powerDays].reduce((sum, value) => sum + value, 0);
  statuses["billingPeriod.days"] =
    days === null ? "error" : days === linesDays && !chainBroken ? "verified" : "unverified";
  const span = ficha.billingPeriod
    ? daysBetween(ficha.billingPeriod.from, ficha.billingPeriod.to)
    : null;
  statuses["billingPeriod.dates"] =
    span !== null && days !== null && (span === days || span + 1 === days)
      ? "verified"
      : "unverified";

  statuses.accessTariff = ficha.accessTariff === "2.0TD" ? "verified" : "unverified";
  statuses.supplierName =
    supplierGuess !== "otra" &&
    normalize(ficha.supplierName).includes(normalize(supplierGuess).split(" ")[0])
      ? "verified"
      : "unverified";
  statuses.pricing =
    ficha.pricing === "fixed" && !/indexad|omie|pass.?through/i.test(redactedText)
      ? "verified"
      : "unverified";
  statuses.hasSelfConsumption =
    !ficha.hasSelfConsumption && !/autoconsumo|excedente/i.test(redactedText)
      ? "verified"
      : "unverified";
  statuses.issueDate = "unverified";
  statuses.cups = privateCups.some(isValidCups) ? "verified" : "error";

  for (const field of confirmedFields) {
    if (statuses[field] === "unverified") statuses[field] = "confirmed";
  }
  return statuses;
}
