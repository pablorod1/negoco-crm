import { describe, expect, test } from "vitest";
import { naturgyInvoice } from "./fixtures";
import type { InvoiceExtraction } from "./invoice-schema";
import { normalizePowerLines, reconcileVat } from "./normalize";
import { validateInvoice } from "./validate";

function withPowerLine(line: InvoiceExtraction["powerLines"][number]) {
  return { ...naturgyInvoice, powerLines: [line] };
}

describe("normalizePowerLines", () => {
  test("converts €/kW·mes with the billed months (1,10 meses)", () => {
    const [line] = normalizePowerLines(
      withPowerLine({
        period: "P1",
        kw: 3.3,
        days: 34,
        pricePerKwDay: 0,
        amount: 11.35,
        originalPrice: { unit: "kW·mes", price: 3.127434, months: 1.1 },
      }),
    ).powerLines;

    expect(line.pricePerKwDay).toBeCloseTo((3.127434 * 12) / 365, 10);
    expect(line.kw * line.days * line.pricePerKwDay).toBeCloseTo(3.3 * 1.1 * 3.127434, 8);
  });

  test("derives the months from the amount when the invoice omits them", () => {
    const invoice = normalizePowerLines(
      withPowerLine({
        period: "P1",
        kw: 3.45,
        days: 31,
        pricePerKwDay: 0,
        amount: 13.14,
        originalPrice: { unit: "kW·mes", price: 3.808701, months: null },
      }),
    );
    const [line] = invoice.powerLines;

    expect(line.kw * line.days * line.pricePerKwDay).toBeCloseTo(13.14, 8);
    expect(validateInvoice(invoice).map(({ code }) => code)).not.toContain(
      "power_line_mismatch",
    );
  });

  test("converts €/kW·año keeping the days", () => {
    const [line] = normalizePowerLines(
      withPowerLine({
        period: "P1",
        kw: 4.6,
        days: 33,
        pricePerKwDay: 0,
        amount: 11.52,
        originalPrice: { unit: "kW·año", price: 27.704413, months: null },
      }),
    ).powerLines;

    expect(line.days).toBe(33);
    expect(line.pricePerKwDay).toBeCloseTo(27.704413 / 365, 10);
  });

  test("leaves daily prices untouched", () => {
    expect(normalizePowerLines(naturgyInvoice)).toEqual(naturgyInvoice);
  });
});

describe("reconcileVat", () => {
  // Eleia, agosto de 2025: la factura solo da «Impuesto NORMAL 21% (12,08 €)»,
  // sin base imponible, y la IA leyó 12,08 como base e inventó un IVA de 2,54.
  const eleia: InvoiceExtraction = {
    ...naturgyInvoice,
    contractedKw: { P1: 2.2, P2: 2.2 },
    consumptionKwh: { P1: 99, P2: 136, P3: 177 },
    powerLines: [
      { period: "P1", kw: 2.2, days: 35, pricePerKwDay: 0.073782, amount: 5.68, originalPrice: null },
      { period: "P2", kw: 2.2, days: 35, pricePerKwDay: 0.001911, amount: 0.15, originalPrice: null },
      { period: "P1", kw: 2.2, days: 35, pricePerKwDay: 0.008154, amount: 0.63, originalPrice: null },
      { period: "P2", kw: 2.2, days: 35, pricePerKwDay: 0.080025, amount: 6.16, originalPrice: null },
    ],
    energyLines: [
      { period: "P1", kwh: 99, pricePerKwh: 0.092539, amount: 9.16 },
      { period: "P2", kwh: 136, pricePerKwh: 0.028201, amount: 3.84 },
      { period: "P3", kwh: 177, pricePerKwh: 0.002994, amount: 0.53 },
      { period: "P1", kwh: 99, pricePerKwh: 0.006461, amount: 0.64 },
      { period: "P2", kwh: 136, pricePerKwh: 0.070799, amount: 9.63 },
      { period: "P3", kwh: 177, pricePerKwh: 0.096006, amount: 16.99 },
    ],
    energyDiscounts: [],
    otherElectricityLines: [],
    socialBonusLines: [{ days: null, pricePerDay: null, amount: 0.45 }],
    electricityTax: { base: 53.86, ratePercent: 5.11269632, amount: 2.75 },
    meterRental: { days: null, pricePerDay: null, amount: 0.93 },
    otherTaxableLines: [],
    vatExemptLines: [],
    taxableBase: 12.08,
    vat: { ratePercent: 21, base: 12.08, amount: 2.54 },
    total: 69.62,
  };

  test("the VAT figure read as the base is put back when lines, rate and total agree", () => {
    const fixed = reconcileVat(eleia);
    expect(fixed.taxableBase).toBe(57.54);
    expect(fixed.vat).toEqual({ ratePercent: 21, base: 57.54, amount: 12.08 });
    expect(validateInvoice(fixed).filter(({ severity }) => severity === "blocking")).toEqual([]);
  });

  test("leaves the reading alone when the invoice does not show that VAT or the total does not agree", () => {
    const noVatFigure = { ...eleia, taxableBase: 30, vat: { ratePercent: 21, base: 30, amount: 6.3 } };
    expect(reconcileVat(noVatFigure)).toBe(noVatFigure);
    const otherTotal = { ...eleia, total: 75 };
    expect(reconcileVat(otherTotal)).toBe(otherTotal);
    const right = { ...eleia, taxableBase: 57.54, vat: { ratePercent: 21, base: 57.54, amount: 12.08 } };
    expect(reconcileVat(right)).toBe(right);
  });
});
