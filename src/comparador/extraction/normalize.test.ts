import { describe, expect, test } from "vitest";
import { naturgyInvoice } from "./fixtures";
import type { InvoiceExtraction } from "./invoice-schema";
import {
  alignEnergyKwh,
  ELECTRICITY_TAX_RATE,
  exactElectricityTaxRate,
  fillBillingDays,
  inferPricing,
  normalizePowerLines,
  reconcileChain,
  reconcileVat,
  singleEnergyPriceAsAll,
  surplusCompensationAsOther,
} from "./normalize";
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
    const chain = ["electricity_tax_base_mismatch", "electricity_tax_mismatch", "taxable_base_mismatch", "vat_mismatch", "total_mismatch"];
    expect(validateInvoice(fixed).filter(({ code }) => chain.includes(code))).toEqual([]);
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

describe("inferPricing", () => {
  const lines = (p1: number, p2: number, p3: number): InvoiceExtraction["energyLines"] => [
    { period: "P1", kwh: 48, pricePerKwh: p1, amount: 0 },
    { period: "P2", kwh: 56, pricePerKwh: p2, amount: 0 },
    { period: "P3", kwh: 90, pricePerKwh: p3, amount: 0 },
  ];

  test("an off-peak price above mid-peak means indexed (Eni, Feníe)", () => {
    const invoice = { ...naturgyInvoice, energyLines: lines(0.1866806, 0.1704042, 0.2173215) };
    expect(inferPricing(invoice, null).pricing).toBe("indexed");
  });

  test("a fixed tariff falls from P1 to P3 or has one price", () => {
    const threePeriods = { ...naturgyInvoice, energyLines: lines(0.1777, 0.1039, 0.0695) };
    expect(inferPricing(threePeriods, null)).toBe(threePeriods);
    expect(inferPricing(naturgyInvoice, "Precio fijo 12 meses. Consulta el OMIE")).toBe(naturgyInvoice);
  });

  test("the text names an indexed product, a daily price or PVPC (Repsol, Curenergía)", () => {
    for (const text of ["tarifa-precioindexado/producto-indexado/", "tu precio diario", "TIPO DE CONTRATO: PVPC"]) {
      expect(inferPricing({ ...naturgyInvoice, pricing: "unknown" }, text).pricing).toBe("indexed");
    }
  });

  test("keeps a flat-rate reading", () => {
    const flat = { ...naturgyInvoice, pricing: "flat" as const };
    expect(inferPricing(flat, "precio indexado")).toBe(flat);
  });
});

describe("fillBillingDays", () => {
  const withoutPeriod = { ...naturgyInvoice, billingPeriod: null };

  test("takes the days from what is charged per day when they agree (Jazztel)", () => {
    const invoice = { ...withoutPeriod, meterRental: { days: 31, pricePerDay: 0.02663, amount: 0.83 } };
    expect(fillBillingDays({ ...invoice, socialBonusLines: [], powerLines: [] }).billingPeriod).toEqual({
      from: null,
      to: null,
      days: 31,
    });
  });

  test("leaves it empty when the daily lines disagree", () => {
    const invoice = {
      ...withoutPeriod,
      powerLines: [],
      meterRental: { days: 31, pricePerDay: 0.02663, amount: 0.83 },
      socialBonusLines: [{ days: 30, pricePerDay: 0.024688, amount: 0.74 }],
    };
    expect(fillBillingDays(invoice).billingPeriod).toBeNull();
  });
});

describe("singleEnergyPriceAsAll", () => {
  test("one price for all the consumption is ALL, not P1 (Repsol)", () => {
    const invoice = {
      ...naturgyInvoice,
      consumptionKwh: { P1: 79, P2: 71, P3: 144 },
      energyLines: [{ period: "P1" as const, kwh: 294, pricePerKwh: 0.111681, amount: 32.83 }],
    };
    expect(singleEnergyPriceAsAll(invoice).energyLines[0].period).toBe("ALL");
  });

  test("keeps a P1 line that only covers P1", () => {
    const invoice = {
      ...naturgyInvoice,
      consumptionKwh: { P1: 79, P2: 71, P3: 144 },
      energyLines: [{ period: "P1" as const, kwh: 79, pricePerKwh: 0.2, amount: 15.8 }],
    };
    expect(singleEnergyPriceAsAll(invoice)).toBe(invoice);
  });
});

describe("reconcileChain", () => {
  // Yoigo: un descuento que va después del impuesto eléctrico, un anuncio
  // leído como línea y una base del impuesto que la factura no imprime.
  const yoigo: InvoiceExtraction = {
    ...naturgyInvoice,
    powerLines: [{ period: "P1", kw: 4, days: 30, pricePerKwDay: 0.5, amount: 21.47, originalPrice: null }],
    energyLines: [{ period: "ALL", kwh: 490, pricePerKwh: 0.128, amount: 62.71 }],
    socialBonusLines: [{ days: null, pricePerDay: null, amount: 0.58 }],
    energyDiscounts: [{ description: "Descuento bienvenida 50€", amount: -8.27 }],
    otherElectricityLines: [],
    otherTaxableLines: [{ description: "Protege tu hogar por 3,90€/mes", amount: 3.9 }],
    vatExemptLines: [],
    meterRental: { days: 31, pricePerDay: 0.02663, amount: 0.83 },
    electricityTax: { base: 84.18, ratePercent: 5.1127, amount: 4.33 },
    vat: { ratePercent: 21, base: 81.65, amount: 17.15 },
    taxableBase: 81.65,
    total: 98.8,
  };

  test("the only placement that matches the printed tax, VAT and total wins", () => {
    const fixed = reconcileChain(yoigo);
    expect(fixed.energyDiscounts).toEqual([]);
    expect(fixed.otherTaxableLines).toEqual([{ description: "Descuento bienvenida 50€", amount: -8.27 }]);
    expect(fixed.electricityTax?.base).toBe(84.76);
    const chain = ["electricity_tax_base_mismatch", "electricity_tax_mismatch", "taxable_base_mismatch", "vat_mismatch", "total_mismatch"];
    expect(validateInvoice(fixed).filter(({ code }) => chain.includes(code))).toEqual([]);
  });

  test("leaves a reading that already matches, or one nothing can fix", () => {
    const fixed = reconcileChain(yoigo);
    expect(reconcileChain(fixed)).toBe(fixed);
    const hopeless = { ...yoigo, total: 120 };
    expect(reconcileChain(hopeless)).toBe(hopeless);
  });
});

describe("surplusCompensationAsOther", () => {
  test("the surplus compensation is not consumption (Naturgy)", () => {
    const invoice = {
      ...naturgyInvoice,
      consumptionKwh: { P1: 3, P2: 10, P3: 96 },
      energyLines: [
        { period: "ALL" as const, kwh: 109, pricePerKwh: 0.144972, amount: 15.8 },
        { period: "ALL" as const, kwh: -260, pricePerKwh: 0.06, amount: -15.6 },
      ],
    };
    const fixed = surplusCompensationAsOther(invoice);
    expect(fixed.energyLines).toHaveLength(1);
    expect(fixed.otherElectricityLines).toEqual([
      { description: "Compensación de excedentes (260 kWh × 0.06 €/kWh)", amount: -15.6 },
    ]);
    expect(fixed.hasSelfConsumption).toBe(true);
  });

  test("a negative energy line without self-consumption stays (a regularisation)", () => {
    const invoice = {
      ...naturgyInvoice,
      energyLines: [{ period: "ALL" as const, kwh: 20, pricePerKwh: 0.1, amount: -2 }],
    };
    expect(surplusCompensationAsOther(invoice)).toBe(invoice);
  });
});

describe("alignEnergyKwh", () => {
  test("takes the exact kWh another line of the period multiplies (TotalEnergies)", () => {
    const invoice = {
      ...naturgyInvoice,
      consumptionKwh: { P1: 0, P2: 408, P3: 0 },
      energyLines: [
        { period: "P2" as const, kwh: 408.35, pricePerKwh: 0.016409, amount: 6.7 },
        { period: "P2" as const, kwh: 408, pricePerKwh: 0.173554, amount: 70.87 },
      ],
    };
    expect(alignEnergyKwh(invoice).energyLines[1].kwh).toBe(408.35);
  });
});

describe("exactElectricityTaxRate", () => {
  test("a rounded general rate becomes the exact one", () => {
    const invoice = { ...naturgyInvoice, electricityTax: { base: 388.52, ratePercent: 5.1, amount: 19.86 } };
    expect(exactElectricityTaxRate(invoice).electricityTax?.ratePercent).toBe(ELECTRICITY_TAX_RATE);
  });

  test("a reduced rate stays", () => {
    const invoice = { ...naturgyInvoice, electricityTax: { base: 100, ratePercent: 2.5, amount: 2.5 } };
    expect(exactElectricityTaxRate(invoice)).toBe(invoice);
  });
});
