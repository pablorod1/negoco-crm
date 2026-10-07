import { sumEuros } from "@/comparador/engine/money";
import { periodPricesFromInvoice } from "./current-tariff";
import { normalizeIdentifier } from "./identifiers";
import type { InvoiceExtraction } from "./invoice-schema";
import { hasBlockingIssues, validateInvoice } from "./validate";

type Value = number | string | null;

/**
 * Campos que entran en el cálculo. Un error en cualquiera de ellos cambia el
 * ahorro que ve el cliente.
 */
export const CALCULATION_FIELDS = [
  "cups",
  "accessTariff",
  "days",
  "contractedP1",
  "contractedP2",
  "kwhP1",
  "kwhP2",
  "kwhP3",
  "powerPriceP1",
  "powerPriceP2",
  "energyPriceP1",
  "energyPriceP2",
  "energyPriceP3",
  "energyDiscounts",
  "otherElectricity",
  "socialBonus",
  "meterRentalAmount",
  "otherTaxable",
  "vatExempt",
  "total",
] as const;

/** Campos que se miden pero no cambian el cálculo. */
/**
 * Campos que se miden pero no cambian el cálculo. Si el precio es fijo o
 * indexado lo confirma el comercial: muchas facturas no lo dicen.
 */
export const INFORMATIVE_FIELDS = ["supplierName", "holderTaxId", "pricing"] as const;

export type FieldName =
  | (typeof CALCULATION_FIELDS)[number]
  | (typeof INFORMATIVE_FIELDS)[number];

export interface EvaluationOptions {
  /** Campos que no se puntúan (por ejemplo, los que van tapados en el texto). */
  ignore?: readonly FieldName[];
  /**
   * CUPS leído en local, sin IA. Con el texto anonimizado la IA no lo ve, así
   * que se añade antes de validar, igual que en producción.
   */
  localCups?: string | null;
}

/** Resume una extracción en los valores que se comparan con la ficha. */
export function summarizeForEvaluation(
  invoice: InvoiceExtraction,
): Record<FieldName, Value> {
  // Cada precio por separado: un precio de energía que falta no invalida la potencia.
  const prices = periodPricesFromInvoice(invoice);
  const sumAmounts = (lines: readonly { amount: number }[]) =>
    sumEuros(lines.map(({ amount }) => amount));

  return {
    cups: invoice.cups ? normalizeIdentifier(invoice.cups) : null,
    accessTariff: invoice.accessTariff?.replace(/\s/g, "").toUpperCase() ?? null,
    pricing: invoice.pricing,
    days: invoice.billingPeriod?.days ?? null,
    contractedP1: invoice.contractedKw.P1,
    contractedP2: invoice.contractedKw.P2,
    kwhP1: invoice.consumptionKwh.P1,
    kwhP2: invoice.consumptionKwh.P2,
    kwhP3: invoice.consumptionKwh.P3,
    powerPriceP1: prices.power.P1,
    powerPriceP2: prices.power.P2,
    energyPriceP1: prices.energy.P1,
    energyPriceP2: prices.energy.P2,
    energyPriceP3: prices.energy.P3,
    energyDiscounts: sumAmounts(invoice.energyDiscounts),
    otherElectricity: sumAmounts(invoice.otherElectricityLines),
    socialBonus: sumAmounts(invoice.socialBonusLines),
    // El importe: muchas facturas no imprimen el €/día del alquiler.
    meterRentalAmount: invoice.meterRental?.amount ?? null,
    otherTaxable: sumAmounts(invoice.otherTaxableLines),
    vatExempt: sumAmounts(invoice.vatExemptLines),
    total: invoice.total,
    // Basta con la primera palabra: «Endesa» y «Endesa Energía, S.A.U.» son la misma.
    supplierName:
      invoice.supplierName
        ?.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .match(/[a-z0-9]+/)?.[0] ?? null,
    holderTaxId: invoice.holder.taxId
      ? normalizeIdentifier(invoice.holder.taxId)
      : null,
  };
}

function sameValue(expected: Value, actual: Value): boolean {
  if (typeof expected === "number" && typeof actual === "number") {
    // Precios con hasta 6 decimales e importes en céntimos.
    return Math.abs(expected - actual) <= 5e-7 + Math.abs(expected) * 1e-9;
  }
  return expected === actual;
}

export interface InvoiceEvaluation {
  name: string;
  supplier: string | null;
  /** Campo → si coincide con la ficha verificada. */
  fields: Record<FieldName, boolean>;
  /** La extracción tenía incidencias bloqueantes: iría a revisión manual. */
  flagged: boolean;
  /** Sin incidencias y con todos los campos de cálculo correctos. */
  clean: boolean;
  /**
   * Pasa las validaciones pero algún campo de cálculo está mal. Es el único
   * error que llegaría al cliente; el objetivo es que sea cero.
   */
  silentError: boolean;
  wrongFields: FieldName[];
}

export function evaluateExtraction(
  name: string,
  expected: InvoiceExtraction,
  actual: InvoiceExtraction,
  options: EvaluationOptions = {},
): InvoiceEvaluation {
  const expectedValues = summarizeForEvaluation(expected);
  const actualValues = summarizeForEvaluation(actual);
  const fieldNames = [...CALCULATION_FIELDS, ...INFORMATIVE_FIELDS];
  const ignored = new Set<FieldName>(options.ignore);

  const fields = Object.fromEntries(
    fieldNames.map((field) => [
      field,
      ignored.has(field) ||
        sameValue(expectedValues[field], actualValues[field]),
    ]),
  ) as Record<FieldName, boolean>;

  const wrongFields = fieldNames.filter((field) => !fields[field]);
  const calculationCorrect = CALCULATION_FIELDS.every((field) => fields[field]);
  const validated =
    options.localCups === undefined
      ? actual
      : { ...actual, cups: options.localCups };
  const flagged = hasBlockingIssues(validateInvoice(validated));

  return {
    name,
    supplier: expected.supplierName,
    fields,
    flagged,
    clean: !flagged && calculationCorrect,
    silentError: !flagged && !calculationCorrect,
    wrongFields,
  };
}

export interface EvaluationSummary {
  invoices: number;
  cleanRate: number;
  flaggedRate: number;
  silentErrors: number;
  fieldAccuracy: Record<string, number>;
  cleanRateBySupplier: Record<string, number>;
}

export function summarizeEvaluations(
  evaluations: readonly InvoiceEvaluation[],
): EvaluationSummary {
  const count = evaluations.length;
  const rate = (predicate: (e: InvoiceEvaluation) => boolean) =>
    count === 0 ? 0 : evaluations.filter(predicate).length / count;

  const fieldNames = [...CALCULATION_FIELDS, ...INFORMATIVE_FIELDS];
  const fieldAccuracy = Object.fromEntries(
    fieldNames.map((field) => [field, rate((e) => e.fields[field])]),
  );

  const bySupplier = new Map<string, InvoiceEvaluation[]>();
  for (const evaluation of evaluations) {
    const key = evaluation.supplier ?? "desconocida";
    bySupplier.set(key, [...(bySupplier.get(key) ?? []), evaluation]);
  }

  return {
    invoices: count,
    cleanRate: rate((e) => e.clean),
    flaggedRate: rate((e) => e.flagged),
    silentErrors: evaluations.filter((e) => e.silentError).length,
    fieldAccuracy,
    cleanRateBySupplier: Object.fromEntries(
      [...bySupplier].map(([supplier, items]) => [
        supplier,
        items.filter((e) => e.clean).length / items.length,
      ]),
    ),
  };
}
