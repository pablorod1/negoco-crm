import { describe, expect, test, vi } from "vitest";
import { computeCost } from "@/comparador/engine/cost";
import { getRegulatedParams } from "@/comparador/engine/regulated";
import { currentTariffFromInvoice } from "./current-tariff";
import { extractInvoice, buildInstructions } from "./extract-invoice";
import { iberdrolaInvoice, naturgyInvoice } from "./fixtures";
import { isValidCups, isValidSpanishTaxId } from "./identifiers";
import type { InvoiceExtraction } from "./invoice-schema";
import { getSupplierHint } from "./supplier-hints";
import { hasBlockingIssues, validateInvoice } from "./validate";

describe("identifiers", () => {
  test.each([
    "ES0021000015543129GW0F",
    "ES0021000008701291ZC0P",
    "ES0222120028021251AW",
    "es 0021 0000 0000 0001 RK 0F",
  ])("accepts valid CUPS %s", (cups) => {
    expect(isValidCups(cups)).toBe(true);
  });

  test.each(["ES0021000015543129GX0F", "ES002100001554312GW", "FR0021000015543129GW"])(
    "rejects invalid CUPS %s",
    (cups) => {
      expect(isValidCups(cups)).toBe(false);
    },
  );

  test.each(["12345678Z", "X1234567L", "B26833335", "b-26833335"])(
    "accepts valid tax id %s",
    (id) => {
      expect(isValidSpanishTaxId(id)).toBe(true);
    },
  );

  test.each(["12345678A", "B26833336", "P1234567A", "123"])(
    "rejects invalid tax id %s",
    (id) => {
      expect(isValidSpanishTaxId(id)).toBe(false);
    },
  );
});

describe("validateInvoice", () => {
  test.each([
    ["Naturgy", naturgyInvoice],
    ["Iberdrola", iberdrolaInvoice],
  ])("finds no issues in a correct %s invoice", (_, invoice) => {
    expect(validateInvoice(invoice)).toEqual([]);
  });

  test("catches a misread price even when the line amount is right", () => {
    const misread: InvoiceExtraction = {
      ...naturgyInvoice,
      powerLines: [
        { ...naturgyInvoice.powerLines[0], pricePerKwDay: 0.12803 },
        naturgyInvoice.powerLines[1],
      ],
    };

    const issues = validateInvoice(misread);
    expect(issues).toEqual([
      expect.objectContaining({
        code: "power_line_mismatch",
        severity: "blocking",
        expected: 14.13,
        actual: 13.58,
      }),
    ]);
  });

  test("catches a social bonus left out of the electricity tax base", () => {
    const issues = validateInvoice({
      ...naturgyInvoice,
      socialBonusLines: [],
    });
    expect(issues.map(({ code }) => code)).toContain(
      "electricity_tax_base_mismatch",
    );
  });

  test("catches a wrong total and a wrong VAT", () => {
    const codes = validateInvoice({
      ...naturgyInvoice,
      vat: { ratePercent: 21, base: 62.68, amount: 13.61 },
      total: 76.29,
    }).map(({ code }) => code);
    expect(codes).toEqual(["vat_mismatch"]);

    const totalCodes = validateInvoice({ ...naturgyInvoice, total: 75.48 }).map(
      ({ code }) => code,
    );
    expect(totalCodes).toEqual(["total_mismatch"]);
  });

  test("accepts energy charged in two concepts per period", () => {
    const issues = validateInvoice({
      ...naturgyInvoice,
      energyLines: [
        { period: "ALL", kwh: 367, pricePerKwh: 0.08, amount: 29.36 },
        { period: "ALL", kwh: 367, pricePerKwh: 0.0299, amount: 10.97 },
      ],
    });
    expect(issues.map(({ code }) => code)).not.toContain("consumption_mismatch");
  });

  test("marks 3.0TD and indexed invoices as out of scope", () => {
    const issues = validateInvoice({
      ...naturgyInvoice,
      accessTariff: "3.0TD",
      pricing: "indexed",
    });
    expect(issues.filter(({ severity }) => severity === "unsupported")).toHaveLength(2);
  });

  test("an invalid CUPS blocks; an invalid tax id only warns", () => {
    const issues = validateInvoice({
      ...naturgyInvoice,
      cups: "ES0021000000000001AA0F",
      holder: { name: "X", taxId: "12345678A" },
    });
    expect(issues).toEqual([
      expect.objectContaining({ code: "cups_invalid", severity: "blocking" }),
      expect.objectContaining({ code: "tax_id_invalid", severity: "warning" }),
    ]);
  });
});

describe("currentTariffFromInvoice", () => {
  test("recovers prices that reproduce the invoice with the engine", () => {
    const tariff = currentTariffFromInvoice(iberdrolaInvoice)!;

    expect(tariff.prices.energy).toEqual({
      P1: 0.156125,
      P2: 0.156125,
      P3: 0.156125,
    });
    expect(tariff.energyDiscountRates[0]).toBeCloseTo(0.05, 2);
    expect(tariff.energyDiscountRates[1]).toBeCloseTo(0.2, 2);
    // Importe entre días: 0,85 € / 32 días, aunque el €/día impreso sea 0,02663.
    expect(tariff.meterRentalPerDay).toBeCloseTo(0.85 / 32, 10);

    const cost = computeCost({
      days: 28,
      contractedKw: { P1: 3.4, P2: 3.4 },
      energyKwh: { P1: 40, P2: 35, P3: 55 },
      prices: tariff.prices,
      regulated: getRegulatedParams("2026-08-31"),
      energyDiscountRates: [0.05, 0.2],
      meterRental: { perDay: tariff.meterRentalPerDay, days: 32 },
      servicesAmount: 4.15,
    });
    expect(cost.total).toBe(iberdrolaInvoice.total);
  });

  test("returns null when a price is missing", () => {
    expect(
      currentTariffFromInvoice({ ...naturgyInvoice, powerLines: [] }),
    ).toBeNull();
  });
});

describe("extractInvoice cascade", () => {
  const file = {
    data: new Uint8Array([37, 80, 68, 70]),
    mediaType: "application/pdf" as const,
  };
  const context = { tenantSlug: "test", jobType: "invoice_extraction" as const };

  function generator(outputs: InvoiceExtraction[]) {
    const queue = [...outputs];
    return vi.fn(async () => ({
      output: queue.shift()!,
      model: "m",
      usage: {} as never,
      costUsd: 0.001,
    }));
  }

  test("stops at the cheap model when the extraction is coherent", async () => {
    const generate = generator([naturgyInvoice]);
    const result = await extractInvoice({
      file,
      context,
      models: ["cheap", "strong"],
      generate: generate as never,
    });

    expect(result.status).toBe("ok");
    expect(result.attempts.map(({ model }) => model)).toEqual(["cheap"]);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("escalates with the supplier hint when the cheap model misreads", async () => {
    const wrong = { ...iberdrolaInvoice, total: 94.01 };
    const generate = generator([wrong, iberdrolaInvoice]);
    const result = await extractInvoice({
      file,
      context,
      models: ["cheap", "strong"],
      generate: generate as never,
    });

    expect(result.status).toBe("ok");
    expect(result.attempts).toEqual([
      expect.objectContaining({ model: "cheap", usedSupplierHint: false }),
      expect.objectContaining({ model: "strong", usedSupplierHint: true }),
    ]);
    const secondCall = generate.mock.calls[1] as unknown as [
      { instructions: string },
    ];
    expect(secondCall[0].instructions).toContain("Pack Iberdrola Hogar");
  });

  test("hands over for manual review when every model fails", async () => {
    const wrong = { ...naturgyInvoice, total: 1 };
    const result = await extractInvoice({
      file,
      context,
      models: ["cheap", "strong"],
      generate: generator([wrong, wrong]) as never,
    });

    expect(result.status).toBe("needs_review");
    expect(hasBlockingIssues(result.issues)).toBe(true);
    expect(result.attempts).toHaveLength(2);
  });

  test("does not escalate an out-of-scope invoice", async () => {
    const generate = generator([{ ...naturgyInvoice, accessTariff: "3.0TD", total: 1 }]);
    const result = await extractInvoice({
      file,
      context,
      models: ["cheap", "strong"],
      generate: generate as never,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.issues.some(({ code }) => code === "not_2_0td")).toBe(true);
  });
});

describe("supplier hints", () => {
  test("matches by normalized name and is only added when known", () => {
    expect(getSupplierHint("IBERDROLA CLIENTES, S.A.U.")).toContain("Iberdrola");
    expect(getSupplierHint("Energía Desconocida")).toBeNull();
    expect(buildInstructions(null)).not.toContain("Particularidades");
  });
});

describe("energy priced by period", () => {
  test("blocks a period with consumption but no price", () => {
    const issues = validateInvoice({
      ...naturgyInvoice,
      energyLines: [
        { period: "P1", kwh: 13, pricePerKwh: 0.1099, amount: 1.43 },
        { period: "P1", kwh: 354, pricePerKwh: 0.1099, amount: 38.9 },
      ],
    });
    expect(issues.map(({ code }) => code)).toEqual([
      "energy_period_unpriced",
      "energy_period_unpriced",
    ]);
  });

  test("accepts invoices that only print the total of a group of lines", () => {
    const issues = validateInvoice({
      ...naturgyInvoice,
      consumptionKwh: { P1: 100, P2: 100, P3: 167 },
      energyLines: [
        { period: "P1", kwh: 100, pricePerKwh: 0.1099, amount: 40.33 },
        { period: "P2", kwh: 100, pricePerKwh: 0.1099, amount: 0 },
        { period: "P3", kwh: 167, pricePerKwh: 0.1099, amount: 0 },
      ],
    });
    expect(issues).toEqual([]);
  });

  test("still blocks a group whose total does not add up", () => {
    const issues = validateInvoice({
      ...naturgyInvoice,
      consumptionKwh: { P1: 100, P2: 100, P3: 167 },
      energyLines: [
        { period: "P1", kwh: 100, pricePerKwh: 0.1099, amount: 45 },
        { period: "P2", kwh: 100, pricePerKwh: 0.1099, amount: 0 },
        { period: "P3", kwh: 167, pricePerKwh: 0.1099, amount: 0 },
      ],
    });
    expect(issues.map(({ code }) => code)).toContain("energy_line_mismatch");
  });

  test("checks the meter rental only when its daily price is printed", () => {
    const missingPrice = validateInvoice({
      ...naturgyInvoice,
      meterRental: { days: 32, pricePerDay: null, amount: 0.85 },
    });
    expect(missingPrice).toEqual([]);

    const zeroPrice = validateInvoice({
      ...naturgyInvoice,
      meterRental: { days: 32, pricePerDay: 0, amount: 0.85 },
    });
    expect(zeroPrice).toEqual([]);
  });

  test("blocks a contracted power period without a price line", () => {
    const issues = validateInvoice({
      ...naturgyInvoice,
      powerLines: [
        naturgyInvoice.powerLines[0],
        { ...naturgyInvoice.powerLines[1], period: "P1" },
      ],
    });
    expect(issues.map(({ code }) => code)).toEqual(["power_period_unpriced"]);
  });

  test("adds concepts and averages date tranches in the effective price", () => {
    const tariff = currentTariffFromInvoice({
      ...naturgyInvoice,
      consumptionKwh: { P1: 10, P2: 20, P3: 30 },
      energyLines: [
        { period: "P1", kwh: 10, pricePerKwh: 0.1, amount: 1 },
        { period: "P1", kwh: 10, pricePerKwh: 0.03, amount: 0.3 },
        { period: "P2", kwh: 5, pricePerKwh: 0.2, amount: 1 },
        { period: "P2", kwh: 15, pricePerKwh: 0.1, amount: 1.5 },
        { period: "ALL", kwh: 60, pricePerKwh: 0.05, amount: 3 },
      ],
    })!;
    expect(tariff.prices.energy.P1).toBeCloseTo(0.13 + 0.05, 10);
    expect(tariff.prices.energy.P2).toBeCloseTo(0.125 + 0.05, 10);
    expect(tariff.prices.energy.P3).toBeCloseTo(0.05, 10);
  });

  test("the locally read CUPS wins over the model's", async () => {
    const result = await extractInvoice({
      file: { text: "factura" },
      context: { tenantSlug: "test", jobType: "invoice_extraction" },
      knownCups: "ES0021000000000001RK0F",
      models: ["cheap"],
      generate: vi.fn(async () => ({
        output: { ...naturgyInvoice, cups: null },
        model: "cheap",
        usage: {} as never,
        costUsd: 0,
      })) as never,
    });
    expect(result.status).toBe("ok");
    expect(result.extraction.cups).toBe("ES0021000000000001RK0F");
  });
});
