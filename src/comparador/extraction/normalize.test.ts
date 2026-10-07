import { describe, expect, test } from "vitest";
import { naturgyInvoice } from "./fixtures";
import type { InvoiceExtraction } from "./invoice-schema";
import { normalizePowerLines } from "./normalize";
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
