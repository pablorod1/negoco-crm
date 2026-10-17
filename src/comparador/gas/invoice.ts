import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { roundEuros, sumEuros } from "@/comparador/engine/money";
import { discountMonths, flatTariffFromInvoice, type CurrentTariff } from "@/comparador/extraction/current-tariff";
import { isValidCups, isValidSpanishTaxId, normalizeIdentifier } from "@/comparador/extraction/identifiers";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import {
  checkLines,
  differs,
  LINE_TOLERANCE,
  SUM_TOLERANCE,
  type InvoiceIssue,
} from "@/comparador/extraction/validate";
import { gasTariffPrices } from "./cost";
import type { GasInvoiceExtraction } from "./invoice-schema";
import { normalizeGasTariff } from "./regulated";

/**
 * Un estudio de gas guarda la lectura en la forma de la de luz (lo común:
 * comercializadora, periodo, CUPS, titular, total, IVA, contador, servicios)
 * y la lectura de gas entera en `gas`.
 */
export type GasStudyExtraction = InvoiceExtraction & { gas: GasInvoiceExtraction };

export function gasReadingOf(extraction: InvoiceExtraction | null | undefined): GasInvoiceExtraction | null {
  return (extraction as Partial<GasStudyExtraction> | null | undefined)?.gas ?? null;
}

/** €/mes o €/año → €/día. */
function perDay(price: number, unit: "mes" | "año"): number {
  return unit === "mes" ? (price * 12) / DAYS_PER_YEAR : price / DAYS_PER_YEAR;
}

/**
 * Lo leído, con el CUPS sin espacios, el peaje como «RL.n» y el €/día de
 * cada término fijo que la factura da al mes o al año.
 */
export function normalizeGasReading(reading: GasInvoiceExtraction): GasInvoiceExtraction {
  const period = reading.billingPeriod;
  // Sin días impresos, los de las fechas (las dos incluidas, como en las facturas).
  const days =
    period && !(period.days > 0) && period.from && period.to
      ? Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86_400_000) + 1
      : null;
  return {
    ...reading,
    // La TUR es un precio regulado que cambia cada trimestre, no un indexado.
    pricing: reading.regulatedTur && reading.pricing !== "flat" ? "fixed" : reading.pricing,
    billingPeriod: period && days && days > 0 ? { ...period, days } : period,
    cups: reading.cups ? normalizeIdentifier(reading.cups) : null,
    accessTariff: normalizeGasTariff(reading.accessTariff) ?? reading.accessTariff,
    fixedTermLines: reading.fixedTermLines.map((line) => ({
      ...line,
      pricePerDay:
        line.pricePerDay ?? (line.originalPrice ? Math.round(perDay(line.originalPrice.price, line.originalPrice.unit) * 1e6) / 1e6 : null),
    })),
  };
}

/** La lectura de gas en la forma de la de luz, con la de gas dentro. */
export function toStudyExtraction(reading: GasInvoiceExtraction): GasStudyExtraction {
  return {
    supplierName: reading.supplierName,
    invoiceNumber: reading.invoiceNumber,
    issueDate: reading.issueDate,
    billingPeriod: reading.billingPeriod,
    cups: reading.cups,
    holder: reading.holder,
    supplyAddress: reading.supplyAddress,
    accessTariff: reading.accessTariff,
    pricing: reading.pricing,
    hasSelfConsumption: false,
    contractedKw: { P1: null, P2: null },
    consumptionKwh: { P1: reading.consumptionKwh, P2: null, P3: null },
    powerLines: [],
    energyLines: reading.energyLines.map((line) => ({ period: "ALL" as const, ...line })),
    energyDiscounts: reading.discounts.map(({ description, amount }) => ({ description, amount })),
    otherElectricityLines: [],
    socialBonusLines: [],
    electricityTax: null,
    // Los cargos regulados (canon IRC, GTS) van con el contador: los cobra cualquier comercializadora.
    meterRental:
      reading.meterRental || reading.regulatedLines.length
        ? {
            days: reading.regulatedLines.length ? null : (reading.meterRental?.days ?? null),
            pricePerDay: reading.regulatedLines.length ? null : (reading.meterRental?.pricePerDay ?? null),
            amount: sumEuros([reading.meterRental?.amount ?? 0, ...reading.regulatedLines.map(({ amount }) => amount)]),
          }
        : null,
    otherTaxableLines: reading.otherTaxableLines,
    vatExemptLines: reading.vatExemptLines,
    taxableBase: reading.taxableBase,
    vat: combinedVat(reading),
    total: reading.total,
    gas: reading,
  };
}

const sum = (lines: readonly { amount: number }[]) => sumEuros(lines.map(({ amount }) => amount));

/** Las líneas de IVA en una (la forma de la luz): bases e importes sumados, con el tipo de la base mayor. */
export function combinedVat(reading: Pick<GasInvoiceExtraction, "vatLines">): InvoiceExtraction["vat"] {
  const lines = reading.vatLines;
  if (lines.length === 0) return null;
  const main = lines.reduce((best, line) => (line.base > best.base ? line : best));
  return {
    ratePercent: main.ratePercent,
    base: sumEuros(lines.map(({ base }) => base)),
    amount: sumEuros(lines.map(({ amount }) => amount)),
  };
}

/** Base imponible que sale de las líneas: términos, descuentos, impuesto, contador, servicios y cargos sueltos. */
export function expectedGasTaxableBase(reading: GasInvoiceExtraction): number {
  return sumEuros([
    sum(reading.fixedTermLines),
    sum(reading.energyLines),
    sum(reading.discounts),
    reading.hydrocarbonTax?.amount ?? 0,
    reading.meterRental?.amount ?? 0,
    sum(reading.regulatedLines),
    sum(reading.otherTaxableLines),
    sum(reading.oneOffLines),
  ]);
}

/**
 * Comprueba que la factura de gas cuadra consigo misma, como la de luz: cada
 * término es cantidad × precio, el consumo es el de las líneas, el impuesto
 * de hidrocarburos son los kWh por su tipo y la base, el IVA y el total
 * suman sus partes.
 */
export function validateGasInvoice(reading: GasInvoiceExtraction): InvoiceIssue[] {
  const issues: InvoiceIssue[] = [];
  const add = (issue: InvoiceIssue) => issues.push(issue);
  const flat = reading.pricing === "flat";

  if (reading.accessTariff && !normalizeGasTariff(reading.accessTariff)) {
    add({ code: "unsupported_gas_tariff", severity: "unsupported", field: "accessTariff", actual: reading.accessTariff });
  }
  if (!reading.cups) add({ code: "missing_field", severity: "blocking", field: "cups" });
  else if (!isValidCups(reading.cups)) add({ code: "cups_invalid", severity: "blocking", field: "cups", actual: reading.cups });
  if (reading.holder.taxId && !isValidSpanishTaxId(reading.holder.taxId)) {
    add({ code: "tax_id_invalid", severity: "warning", field: "holder.taxId", actual: reading.holder.taxId });
  }
  for (const [field, value] of [
    ["billingPeriod", reading.billingPeriod],
    ["vat", reading.vatLines.length ? reading.vatLines : null],
    ["total", reading.total],
    ["consumptionKwh", flat ? 0 : reading.consumptionKwh],
  ] as const) {
    if (value === null) add({ code: "missing_field", severity: "blocking", field });
  }
  // Un periodo sin consumo no lleva término variable ni impuesto: la factura
  // vale igual, aunque no diga a cuánto cobra el kWh.
  const consumed = (reading.consumptionKwh ?? 0) > 0 || reading.consumptionKwh === null;
  if (!flat) {
    if (reading.fixedTermLines.length === 0) add({ code: "missing_field", severity: "blocking", field: "fixedTermLines" });
    if (reading.energyLines.length === 0 && consumed) add({ code: "missing_field", severity: "blocking", field: "energyLines" });
    if (!reading.hydrocarbonTax && consumed) add({ code: "missing_field", severity: "warning", field: "hydrocarbonTax" });
  }

  const days = reading.billingPeriod?.days ?? null;
  // Un precio al mes sin los meses facturados no se puede comprobar: la
  // factura cobra meses, no días (8,17 €/mes en 31 días son 8,17 €).
  checkLines(
    reading.fixedTermLines.filter((line) =>
      line.originalPrice ? line.originalPrice.months !== null : line.pricePerDay !== null && (line.days ?? days) !== null,
    ),
    (line) =>
      line.originalPrice?.months != null ? line.originalPrice.months * line.originalPrice.price : (line.days ?? days)! * line.pricePerDay!,
    "fixed_term_mismatch",
    "fixedTermLines",
    add,
  );
  checkLines(
    reading.energyLines,
    (line) => line.kwh * line.pricePerKwh,
    "energy_line_mismatch",
    "energyLines",
    add,
    // kWh impresos redondeados y multiplicados exactos: medio kWh de margen.
    (line) => LINE_TOLERANCE + (Number.isInteger(line.kwh) ? Math.abs(line.pricePerKwh) / 2 : 0),
  );

  const consumption = reading.consumptionKwh;
  const linesKwh = reading.energyLines.reduce((total, { kwh }) => total + kwh, 0);
  // Las líneas parten el consumo por fechas (suman el total) o lo cobran en
  // varios conceptos (cada uno cubre el total). Un kWh de redondeo por línea.
  // Sin consumo no hay líneas de energía: si las hay, son otra cosa mal leída.
  if (consumption === 0 && reading.energyLines.some(({ kwh }) => kwh > 0)) {
    add({ code: "consumption_mismatch", severity: "blocking", field: "consumptionKwh", expected: linesKwh, actual: 0 });
  }
  if (consumption !== null && consumption > 0 && reading.energyLines.length > 0) {
    const tolerance = Math.max(1, reading.energyLines.length);
    if (![1, 2, 3].some((concepts) => Math.abs(linesKwh - concepts * consumption) <= tolerance * concepts)) {
      add({ code: "consumption_mismatch", severity: "blocking", field: "consumptionKwh", expected: linesKwh, actual: consumption });
    }
  }
  if (consumption && reading.consumptionM3 && reading.conversionFactor) {
    const fromM3 = reading.consumptionM3 * reading.conversionFactor;
    if (Math.abs(fromM3 - consumption) > Math.max(2, consumption * 0.01)) {
      add({ code: "gas_conversion_mismatch", severity: "warning", field: "consumptionM3", expected: Math.round(fromM3), actual: consumption });
    }
  }

  const tax = reading.hydrocarbonTax;
  if (tax && tax.ratePerKwh !== null) {
    const kwh = tax.kwh ?? consumption;
    if (kwh !== null && differs(kwh * tax.ratePerKwh, tax.amount, LINE_TOLERANCE)) {
      add({
        code: "hydrocarbon_tax_mismatch",
        severity: "blocking",
        field: "hydrocarbonTax.amount",
        expected: roundEuros(kwh * tax.ratePerKwh),
        actual: tax.amount,
      });
    }
  }

  const rental = reading.meterRental;
  if (rental && rental.days !== null && rental.pricePerDay !== null && rental.pricePerDay > 0) {
    if (differs(rental.days * rental.pricePerDay, rental.amount, LINE_TOLERANCE)) {
      add({
        code: "meter_rental_mismatch",
        severity: "blocking",
        field: "meterRental",
        expected: roundEuros(rental.days * rental.pricePerDay),
        actual: rental.amount,
      });
    }
  }

  const vat = combinedVat(reading);
  const taxableBase = vat?.base ?? reading.taxableBase;
  // Una tarifa plana cobra una cuota con todo dentro: no hay líneas que sumar.
  if (!flat && taxableBase !== null) {
    const expected = expectedGasTaxableBase(reading);
    if (differs(expected, taxableBase, SUM_TOLERANCE)) {
      add({ code: "taxable_base_mismatch", severity: "blocking", field: "vat.base", expected, actual: taxableBase });
    }
  }
  reading.vatLines.forEach((line, index) => {
    if (differs((line.base * line.ratePercent) / 100, line.amount, LINE_TOLERANCE)) {
      add({
        code: "vat_mismatch",
        severity: "blocking",
        field: `vatLines[${index}].amount`,
        expected: roundEuros((line.base * line.ratePercent) / 100),
        actual: line.amount,
      });
    }
  });
  if (vat && reading.total !== null) {
    const expectedTotal = sumEuros([vat.base, vat.amount, sum(reading.vatExemptLines)]);
    if (differs(expectedTotal, reading.total, LINE_TOLERANCE)) {
      add({ code: "total_mismatch", severity: "blocking", field: "total", expected: expectedTotal, actual: reading.total });
    }
  }
  return issues;
}

/** Lo que paga hoy por el gas, en la forma de las ofertas. */
export interface GasCurrentTariff extends CurrentTariff {
  /** Descuentos sobre el término fijo en tanto por uno. */
  fixedTermDiscountRates: number[];
  /** Descuentos de importe fijo en un año, en € y en positivo. */
  fixedDiscountsPerYear: number[];
}

/** Parte del año que cuenta un descuento: los temporales, sus meses; los demás, todo el año. */
function shareOfYear(description: string, amount: number): number {
  if (amount >= 0) return 1;
  const months = discountMonths(description);
  return months === null || months <= 0 ? 1 : Math.min(months, 12) / 12;
}

/**
 * Término fijo en €/día. Las líneas con los mismos días son conceptos que se
 * suman (peaje y comercialización); las de tramos de fechas distintos se
 * promedian por sus días. Sin precio impreso, el importe entre sus días.
 */
function fixedPerDayOf(reading: GasInvoiceExtraction): number | null {
  const billed = reading.billingPeriod?.days ?? null;
  const tranches = new Map<number, number>();
  for (const line of reading.fixedTermLines) {
    const days = line.days ?? billed;
    if (!days || days <= 0) continue;
    const price = line.pricePerDay ?? line.amount / days;
    tranches.set(days, (tranches.get(days) ?? 0) + price);
  }
  const totalDays = [...tranches.keys()].reduce((total, days) => total + days, 0);
  if (totalDays <= 0) return null;
  return [...tranches].reduce((total, [days, price]) => total + days * price, 0) / totalDays;
}

/** Término variable en €/kWh: conceptos que cubren todo el consumo se suman; tramos, se promedian. */
function energyPerKwhOf(reading: GasInvoiceExtraction): number | null {
  const kwh = reading.energyLines.reduce((total, line) => total + line.kwh, 0);
  if (kwh <= 0) {
    // Una factura sin consumo imprime igual el €/kWh: los mismos (cero) kWh en todas, como conceptos.
    const printed = reading.energyLines.filter((line) => line.pricePerKwh > 0);
    return printed.length > 0 ? printed.reduce((total, line) => total + line.pricePerKwh, 0) : null;
  }
  const value = reading.energyLines.reduce((total, line) => total + line.kwh * line.pricePerKwh, 0);
  const consumed = reading.consumptionKwh;
  const concepts = consumed && consumed > 0 ? Math.max(1, Math.round(kwh / consumed)) : 1;
  return (value * concepts) / kwh;
}

/**
 * Precios que paga hoy por el gas, de las líneas de su factura, para su coste
 * de un año con la misma fórmula que las ofertas. Los cargos de una sola vez
 * (inspección, alta) no se repiten. null si falta algún precio.
 */
export function gasCurrentTariff(extraction: GasStudyExtraction): GasCurrentTariff | null {
  const reading = extraction.gas;
  if (reading.pricing === "flat") {
    const flat = flatTariffFromInvoice(extraction);
    return flat ? { ...flat, fixedTermDiscountRates: [], fixedDiscountsPerYear: [] } : null;
  }
  const fixedPerDay = fixedPerDayOf(reading);
  const energyPerKwh = energyPerKwhOf(reading);
  const days = reading.billingPeriod?.days ?? 0;
  if (fixedPerDay === null || energyPerKwh === null || days <= 0) return null;

  const fixedAmount = sum(reading.fixedTermLines);
  const energyAmount = sum(reading.energyLines);
  const energyDiscountRates: number[] = [];
  const fixedTermDiscountRates: number[] = [];
  const fixedDiscountsPerYear: number[] = [];
  for (const { description, amount, appliesTo } of reading.discounts) {
    const share = shareOfYear(description, amount);
    const value = Math.abs(amount);
    if (appliesTo === "energy" && energyAmount > 0) energyDiscountRates.push((value / energyAmount) * share);
    else if (appliesTo === "fixed" && fixedAmount > 0) fixedTermDiscountRates.push((value / fixedAmount) * share);
    else if (appliesTo === "both" && energyAmount + fixedAmount > 0) {
      const rate = (value / (energyAmount + fixedAmount)) * share;
      energyDiscountRates.push(rate);
      fixedTermDiscountRates.push(rate);
    } else fixedDiscountsPerYear.push(((value * DAYS_PER_YEAR) / days) * share);
  }
  const servicesInPeriod = reading.otherTaxableLines.reduce(
    (total, { description, amount }) => total + amount * shareOfYear(description, amount),
    0,
  );
  return {
    prices: gasTariffPrices(fixedPerDay, energyPerKwh, {
      servicesPerYear: (servicesInPeriod * DAYS_PER_YEAR) / days,
      vatExemptPerYear: (sum(reading.vatExemptLines) * DAYS_PER_YEAR) / days,
    }),
    energyDiscountRates,
    fixedTermDiscountRates,
    fixedDiscountsPerYear,
    meterRentalPerDay: gasMeterRentalPerDay(reading),
  };
}

/**
 * El contador y los cargos regulados (canon IRC, GTS), por día: se pagan con
 * cualquier comercializadora, así que van también en las ofertas.
 */
export function gasMeterRentalPerDay(reading: GasInvoiceExtraction): number {
  const days = reading.billingPeriod?.days ?? 0;
  if (days <= 0) return 0;
  const rental = reading.meterRental;
  const rentalDays = rental?.days ?? days;
  return (rental && rentalDays > 0 ? rental.amount / rentalDays : 0) + sum(reading.regulatedLines) / days;
}

/**
 * El impuesto de hidrocarburos y el IVA de la factura, para aplicar a las
 * ofertas los mismos que paga el cliente (en 2026 han cambiado varias veces).
 * Solo se usa un tipo si cuadra con su base y su importe.
 */
export function gasInvoiceTaxRates(reading: GasInvoiceExtraction): { hydrocarbonTaxPerKwh?: number; vatRate?: number } {
  const tax = reading.hydrocarbonTax;
  const kwh = tax?.kwh ?? reading.consumptionKwh;
  const hydrocarbon =
    tax && tax.ratePerKwh !== null && kwh && tax.ratePerKwh > 0 && tax.ratePerKwh < 0.01 && !differs(kwh * tax.ratePerKwh, tax.amount, LINE_TOLERANCE)
      ? tax.ratePerKwh
      : undefined;
  // El tipo del gas: el de la base mayor (el contador puede ir a otro).
  const vat = reading.vatLines.length ? reading.vatLines.reduce((best, line) => (line.base > best.base ? line : best)) : null;
  const vatRate =
    vat && vat.base > 0 && vat.ratePercent >= 0 && vat.ratePercent <= 25 && !differs((vat.base * vat.ratePercent) / 100, vat.amount, LINE_TOLERANCE)
      ? vat.ratePercent / 100
      : undefined;
  return { ...(hydrocarbon !== undefined ? { hydrocarbonTaxPerKwh: hydrocarbon } : {}), ...(vatRate !== undefined ? { vatRate } : {}) };
}
