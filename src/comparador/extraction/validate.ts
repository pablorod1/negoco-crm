import { roundEuros, sumEuros } from "@/comparador/engine/money";
import { isValidCups, isValidSpanishTaxId } from "./identifiers";
import type { InvoiceExtraction } from "./invoice-schema";

/** Diferencia admitida por línea: un céntimo y algo de holgura. */
const LINE_TOLERANCE = 0.011;
/** Diferencia admitida en sumas de varias líneas redondeadas. */
const SUM_TOLERANCE = 0.021;
/** Redondeo del consumo por periodo que admiten las distribuidoras. */
const KWH_ROUNDING_PER_PERIOD = 1;

export type InvoiceIssueCode =
  | "not_2_0td"
  | "indexed_pricing"
  | "missing_field"
  | "cups_invalid"
  | "tax_id_invalid"
  | "power_line_mismatch"
  | "energy_line_mismatch"
  | "social_bonus_mismatch"
  | "meter_rental_mismatch"
  | "consumption_mismatch"
  | "energy_period_unpriced"
  | "power_period_unpriced"
  | "electricity_tax_base_mismatch"
  | "electricity_tax_mismatch"
  | "taxable_base_mismatch"
  | "vat_mismatch"
  | "total_mismatch";

export interface InvoiceIssue {
  code: InvoiceIssueCode;
  /**
   * `blocking`: el dato entra en el cálculo y no cuadra; no se comparan
   * ofertas hasta corregirlo. `warning`: conviene revisarlo, pero no cambia
   * el cálculo. `unsupported`: la factura está fuera del alcance de la v1.
   */
  severity: "blocking" | "warning" | "unsupported";
  field: string;
  expected?: number | string;
  actual?: number | string | null;
}

function differs(expected: number, actual: number, tolerance: number) {
  return Math.abs(roundEuros(expected) - actual) > tolerance;
}

/**
 * Comprueba que la factura extraída es coherente consigo misma: cada línea es
 * cantidad × precio, las bases suman sus partes y los impuestos cuadran. Si
 * todo cuadra, un dato mal leído tendría que estar mal en dos sitios a la vez
 * de forma compatible, que es lo que evita los errores silenciosos.
 */
export function validateInvoice(invoice: InvoiceExtraction): InvoiceIssue[] {
  const issues: InvoiceIssue[] = [];
  const add = (issue: InvoiceIssue) => issues.push(issue);

  if (invoice.accessTariff && !/^2\.0\s*TD$/i.test(invoice.accessTariff.trim())) {
    add({
      code: "not_2_0td",
      severity: "unsupported",
      field: "accessTariff",
      actual: invoice.accessTariff,
    });
  }
  if (invoice.pricing === "indexed") {
    add({ code: "indexed_pricing", severity: "unsupported", field: "pricing" });
  }

  if (!invoice.cups) {
    add({ code: "missing_field", severity: "blocking", field: "cups" });
  } else if (!isValidCups(invoice.cups)) {
    add({
      code: "cups_invalid",
      severity: "blocking",
      field: "cups",
      actual: invoice.cups,
    });
  }
  if (invoice.holder.taxId && !isValidSpanishTaxId(invoice.holder.taxId)) {
    add({
      code: "tax_id_invalid",
      severity: "warning",
      field: "holder.taxId",
      actual: invoice.holder.taxId,
    });
  }

  for (const [field, value] of [
    ["contractedKw.P1", invoice.contractedKw.P1],
    ["contractedKw.P2", invoice.contractedKw.P2],
    ["billingPeriod", invoice.billingPeriod],
    ["electricityTax", invoice.electricityTax],
    ["vat", invoice.vat],
    ["total", invoice.total],
  ] as const) {
    if (value === null) add({ code: "missing_field", severity: "blocking", field });
  }
  // Una 2.0TD siempre tiene consumo en los tres periodos, aunque sea cero.
  for (const period of ["P1", "P2", "P3"] as const) {
    if (invoice.consumptionKwh[period] === null) {
      add({ code: "missing_field", severity: "blocking", field: `consumptionKwh.${period}` });
    }
  }
  if (invoice.powerLines.length === 0) {
    add({ code: "missing_field", severity: "blocking", field: "powerLines" });
  }
  if (invoice.energyLines.length === 0) {
    add({ code: "missing_field", severity: "blocking", field: "energyLines" });
  }

  checkLines(
    invoice.powerLines,
    (line) => line.kw * line.days * line.pricePerKwDay,
    "power_line_mismatch",
    "powerLines",
    add,
  );
  checkLines(
    invoice.energyLines,
    (line) => line.kwh * line.pricePerKwh,
    "energy_line_mismatch",
    "energyLines",
    add,
  );
  // Sin días o sin precio por día (factura que no los imprime, o que cobra
  // el bono al mes) solo cuenta el importe, que se comprueba en las bases.
  // Un precio 0 con importe positivo también es «no impreso».
  const printed = (price: number | null, amount: number) =>
    price !== null && !(price === 0 && amount > 0);
  checkLines(
    invoice.socialBonusLines.filter(
      (line) => line.days !== null && printed(line.pricePerDay, line.amount),
    ),
    (line) => line.days! * line.pricePerDay!,
    "social_bonus_mismatch",
    "socialBonusLines",
    add,
  );
  const rental = invoice.meterRental;
  if (
    rental &&
    rental.days !== null &&
    rental.pricePerDay !== null &&
    printed(rental.pricePerDay, rental.amount)
  ) {
    const { days, pricePerDay, amount } = rental;
    if (differs(days * pricePerDay, amount, LINE_TOLERANCE)) {
      add({
        code: "meter_rental_mismatch",
        severity: "blocking",
        field: "meterRental",
        expected: roundEuros(days * pricePerDay),
        actual: amount,
      });
    }
  }

  // El consumo por periodo tiene que coincidir con el de las líneas.
  const consumptionTotal = sumEuros(
    [invoice.consumptionKwh.P1, invoice.consumptionKwh.P2, invoice.consumptionKwh.P3]
      .map((kwh) => kwh ?? 0),
  );
  const linesKwh = sumEuros(invoice.energyLines.map(({ kwh }) => kwh));
  // Las líneas pueden partir el consumo por fechas (suman el total) o cobrarlo
  // en varios conceptos (energía y peajes: cada uno cubre el total). El
  // consumo por periodo suele venir redondeado: hasta 1 kWh por periodo.
  const tolerance = 3 * KWH_ROUNDING_PER_PERIOD;
  const coversConsumption = [1, 2, 3, 4].some(
    (concepts) =>
      Math.abs(linesKwh - concepts * consumptionTotal) <= tolerance * concepts,
  );
  if (invoice.energyLines.length > 0 && !coversConsumption) {
    add({
      code: "consumption_mismatch",
      severity: "blocking",
      field: "consumptionKwh",
      expected: linesKwh,
      actual: consumptionTotal,
    });
  }

  // Cada periodo con consumo necesita un precio: una línea suya o de precio
  // único. Si no, la tarifa actual no se puede calcular.
  const hasSinglePrice = invoice.energyLines.some(({ period }) => period === "ALL");
  for (const period of ["P1", "P2", "P3"] as const) {
    const consumed = invoice.consumptionKwh[period] ?? 0;
    const priced =
      hasSinglePrice || invoice.energyLines.some((line) => line.period === period);
    if (consumed > 0 && !priced) {
      add({
        code: "energy_period_unpriced",
        severity: "blocking",
        field: `energyLines.${period}`,
        actual: consumed,
      });
    }
  }

  // Lo mismo con la potencia: cada periodo contratado necesita su línea.
  for (const period of ["P1", "P2"] as const) {
    const contracted = invoice.contractedKw[period] ?? 0;
    const priced = invoice.powerLines.some((line) => line.period === period);
    if (contracted > 0 && !priced) {
      add({
        code: "power_period_unpriced",
        severity: "blocking",
        field: `powerLines.${period}`,
        actual: contracted,
      });
    }
  }

  const electricitySubtotal = sumEuros([
    ...invoice.powerLines.map(({ amount }) => amount),
    ...invoice.energyLines.map(({ amount }) => amount),
    ...invoice.energyDiscounts.map(({ amount }) => amount),
    ...invoice.otherElectricityLines.map(({ amount }) => amount),
    ...invoice.socialBonusLines.map(({ amount }) => amount),
  ]);

  const tax = invoice.electricityTax;
  if (tax) {
    if (differs(electricitySubtotal, tax.base, SUM_TOLERANCE)) {
      add({
        code: "electricity_tax_base_mismatch",
        severity: "blocking",
        field: "electricityTax.base",
        expected: electricitySubtotal,
        actual: tax.base,
      });
    }
    if (differs((tax.base * tax.ratePercent) / 100, tax.amount, LINE_TOLERANCE)) {
      add({
        code: "electricity_tax_mismatch",
        severity: "blocking",
        field: "electricityTax.amount",
        expected: roundEuros((tax.base * tax.ratePercent) / 100),
        actual: tax.amount,
      });
    }
  }

  const expectedBase = sumEuros([
    tax?.base ?? electricitySubtotal,
    tax?.amount ?? 0,
    invoice.meterRental?.amount ?? 0,
    ...invoice.otherTaxableLines.map(({ amount }) => amount),
  ]);
  const taxableBase = invoice.vat?.base ?? invoice.taxableBase;
  if (taxableBase !== null && differs(expectedBase, taxableBase, SUM_TOLERANCE)) {
    add({
      code: "taxable_base_mismatch",
      severity: "blocking",
      field: "vat.base",
      expected: expectedBase,
      actual: taxableBase,
    });
  }

  const vat = invoice.vat;
  if (vat && differs((vat.base * vat.ratePercent) / 100, vat.amount, LINE_TOLERANCE)) {
    add({
      code: "vat_mismatch",
      severity: "blocking",
      field: "vat.amount",
      expected: roundEuros((vat.base * vat.ratePercent) / 100),
      actual: vat.amount,
    });
  }

  if (vat && invoice.total !== null) {
    const expectedTotal = sumEuros([
      vat.base,
      vat.amount,
      ...invoice.vatExemptLines.map(({ amount }) => amount),
    ]);
    if (differs(expectedTotal, invoice.total, LINE_TOLERANCE)) {
      add({
        code: "total_mismatch",
        severity: "blocking",
        field: "total",
        expected: expectedTotal,
        actual: invoice.total,
      });
    }
  }

  return issues;
}

/**
 * Cada línea tiene que ser cantidad × precio. Si alguna no cuadra pero la suma
 * del grupo sí, la factura solo imprime el total del grupo (energía, peajes,
 * potencia) y el importe se ha repartido como se ha podido: se da por bueno.
 */
function checkLines<LINE extends { amount: number }>(
  lines: readonly LINE[],
  expectedOf: (line: LINE) => number,
  code: InvoiceIssueCode,
  field: string,
  add: (issue: InvoiceIssue) => void,
) {
  const mismatches = lines
    .map((line, index) => ({ line, index, expected: expectedOf(line) }))
    .filter(({ line, expected }) => differs(expected, line.amount, LINE_TOLERANCE));
  if (mismatches.length === 0) return;

  const expectedTotal = sumEuros(lines.map((line) => roundEuros(expectedOf(line))));
  const actualTotal = sumEuros(lines.map(({ amount }) => amount));
  const groupTolerance = Math.max(LINE_TOLERANCE, 0.006 * lines.length);
  if (Math.abs(expectedTotal - actualTotal) <= groupTolerance) return;

  for (const { line, index, expected } of mismatches) {
    add({
      code,
      severity: "blocking",
      field: `${field}[${index}]`,
      expected: roundEuros(expected),
      actual: line.amount,
    });
  }
}

export function hasBlockingIssues(issues: readonly InvoiceIssue[]): boolean {
  return issues.some(({ severity }) => severity === "blocking");
}
