// @vitest-environment node
import { describe, expect, test } from "vitest";
import { getRegulatedParams } from "@/comparador/engine/regulated";
import type { ActiveOfferPrice } from "@/comparador/rates/repository";
import type { CommissionRule, StoredRatePrice } from "@/comparador/rates/types";
import { rankStudy } from "@/comparador/study/ranking";
import { SupplyUnavailableError } from "@/comparador/study/supply";
import type { ApoloSipsGasConsumptionRow, ApoloSipsGasPointSupplyRow } from "@/integrations/apolo-sips/types";
import { computeGasCost, gasOfferPrices, gasTariffPrices } from "./cost";
import {
  expectedGasTaxableBase,
  gasCurrentTariff,
  gasInvoiceTaxRates,
  normalizeGasReading,
  toStudyExtraction,
  validateGasInvoice,
} from "./invoice";
import type { GasInvoiceExtraction } from "./invoice-schema";
import {
  energyOfTariff,
  gasTariffForKwh,
  gasTollsOn,
  getGasRegulatedParams,
  GasRegulatedUnavailableError,
  normalizeGasTariff,
} from "./regulated";
import { buildGasSupply } from "./supply";

const regulated = getGasRegulatedParams("2026-10-15");

/**
 * Factura de gas de ejemplo (sin factura real todavía en el banco): RL.2,
 * 61 días, 1.234 kWh, 10 % de descuento en el variable, mantenimiento y una
 * inspección periódica. Los importes, calculados línea a línea y redondeados
 * como una factura.
 */
function invoice(overrides: Partial<GasInvoiceExtraction> = {}): GasInvoiceExtraction {
  return {
    supplierName: "Gana Energía",
    invoiceNumber: "G-1",
    issueDate: "2026-10-05",
    billingPeriod: { from: "2026-08-01", to: "2026-09-30", days: 61 },
    cups: "ES0230901000012345JM",
    holder: { name: null, taxId: null },
    supplyAddress: null,
    accessTariff: "RL.2",
    regulatedTur: false,
    pricing: "fixed",
    consumptionKwh: 1234,
    consumptionM3: 112,
    conversionFactor: 11.018,
    fixedTermLines: [{ days: 61, pricePerDay: 0.3, originalPrice: null, amount: 18.3 }],
    energyLines: [{ kwh: 1234, pricePerKwh: 0.075, amount: 92.55 }],
    discounts: [{ description: "10 % sobre el consumo", appliesTo: "energy", amount: -9.26 }],
    hydrocarbonTax: { kwh: 1234, ratePerKwh: 0.00234, amount: 2.89 },
    meterRental: { days: 61, pricePerDay: 0.02, amount: 1.22 },
    regulatedLines: [],
    otherTaxableLines: [{ description: "Mantenimiento", amount: 9.99 }],
    oneOffLines: [{ description: "Inspección periódica", amount: 45 }],
    vatExemptLines: [],
    taxableBase: 160.69,
    vatLines: [{ ratePercent: 21, base: 160.69, amount: 33.74 }],
    total: 194.43,
    ...overrides,
  };
}

describe("lo regulado del gas", () => {
  test("peajes: los nombres que se ven en facturas y anexos", () => {
    expect(normalizeGasTariff("RL.1")).toBe("RL.1");
    expect(normalizeGasTariff("RL02")).toBe("RL.2");
    expect(normalizeGasTariff("rl 3")).toBe("RL.3");
    expect(normalizeGasTariff("TUR.2")).toBe("RL.2");
    // Códigos del SIPS (GAS_TIPO_PEAJE): R2 es RL.2; S2 es planta satélite y B5, RL.5.
    expect(normalizeGasTariff("R2")).toBe("RL.2");
    expect(normalizeGasTariff("S2")).toBeNull();
    expect(normalizeGasTariff("B5")).toBeNull();
    // El 3.2 anterior a 2021 iba de 5.000 a 50.000 kWh: no es RL.2.
    expect(normalizeGasTariff("3.2")).toBeNull();
    expect(normalizeGasTariff("RL.5")).toBeNull();
    expect(normalizeGasTariff("2.0TD")).toBeNull();
    expect(energyOfTariff("RL.1")).toBe("gas");
    expect(energyOfTariff("2.0TD")).toBe("electricity");
  });

  test("el peaje de un consumo: el máximo de cada banda entra en ella", () => {
    expect(gasTariffForKwh(3_000)).toBe("RL.1");
    expect(gasTariffForKwh(5_000)).toBe("RL.1");
    expect(gasTariffForKwh(5_001)).toBe("RL.2");
    expect(gasTariffForKwh(50_000)).toBe("RL.3");
    expect(gasTariffForKwh(300_001)).toBeNull();
  });

  test("impuesto de hidrocarburos e IVA desde octubre de 2026", () => {
    expect(regulated).toEqual({ hydrocarbonTaxPerKwh: 0.00234, vatRate: 0.21 });
    expect(() => getGasRegulatedParams("2026-06-01")).toThrow(GasRegulatedUnavailableError);
  });
});

describe("peajes y cargos del gas", () => {
  test("año de gas 2027: los de 2026 sin otros costes de regasificación, como el término fijo de Axpo", () => {
    expect(gasTollsOn("2026-10-15", "RL.1")).toEqual({ fixedPerYear: 25.703907, energyPerKwh: 0.01524 });
    expect(gasTollsOn("2026-10-15", "RL.4")?.fixedPerYear).toBe(512.32255);
    // Año de gas 2026: 2,21 €/mes de peajes del término fijo de RL.1, como en la factura de Másmóvil.
    expect(Math.round(((gasTollsOn("2026-05-15", "RL.1")!.fixedPerYear - 0.29) / 12) * 100) / 100).toBe(2.21);
    expect(gasTollsOn("2027-10-01", "RL.1")).toBeNull();
  });

  test("un precio sin peajes lleva los del BOE; uno a coste, solo los peajes y cargos", () => {
    const tolls = gasTollsOn("2026-10-15", "RL.1");
    const energy = { P1: 0.086731, P2: 0.086731, P3: 0.086731 };
    // Eleia «Tu Eliges» RL.1: 2,231 €/mes sin peajes y 0,086731 €/kWh sin peajes.
    const plus = gasOfferPrices({ powerMode: "regulated_plus", powerMarginPerKwYear: 2.231 * 12, power: null, energy, includesAncillaryServices: false }, tolls)!;
    expect(plus.power.P1).toBeCloseTo((25.703907 + 26.772) / 365, 9);
    expect(plus.energy.P1).toBeCloseTo(0.101971, 9);
    const atCost = gasOfferPrices({ powerMode: "regulated", powerMarginPerKwYear: null, power: null, energy, includesAncillaryServices: true }, tolls)!;
    expect(atCost.power.P1).toBeCloseTo(25.703907 / 365, 9);
    expect(atCost.energy.P1).toBe(0.086731);
    expect(gasOfferPrices({ powerMode: "regulated", powerMarginPerKwYear: null, power: null, energy, includesAncillaryServices: true }, null)).toBeNull();
  });
});

describe("computeGasCost", () => {
  test("reproduce la factura de ejemplo sin el cargo de una sola vez", () => {
    const cost = computeGasCost({
      days: 61,
      kwh: 1234,
      prices: gasTariffPrices(0.3, 0.075),
      regulated,
      energyDiscountRates: [0.1],
      meterRental: { perDay: 0.02 },
      servicesAmount: 9.99,
    });
    expect(cost.kind).toBe("gas");
    expect(cost.power.total).toBe(18.3);
    expect(cost.energy.total).toBe(92.55);
    expect(cost.energyDiscounts).toEqual([-9.26]);
    expect(cost.electricityTax).toBe(2.89);
    expect(cost.meterRental).toBe(1.22);
    // 160,69 de la factura menos los 45 € de la inspección.
    expect(cost.taxableBase).toBe(115.69);
    expect(cost.vat).toBe(24.29);
    expect(cost.total).toBe(139.98);
  });

});

describe("la factura de gas", () => {
  test("una factura que cuadra no tiene avisos que bloqueen", () => {
    const issues = validateGasInvoice(invoice());
    expect(issues.filter(({ severity }) => severity !== "warning")).toEqual([]);
    expect(expectedGasTaxableBase(invoice())).toBe(160.69);
  });

  test("detecta un término fijo, un impuesto y un total que no cuadran", () => {
    const codes = validateGasInvoice(
      invoice({
        fixedTermLines: [{ days: 61, pricePerDay: 0.3, originalPrice: null, amount: 19.3 }],
        hydrocarbonTax: { kwh: 1234, ratePerKwh: 0.00234, amount: 3.89 },
        total: 200,
      }),
    ).map(({ code }) => code);
    expect(codes).toContain("fixed_term_mismatch");
    expect(codes).toContain("hydrocarbon_tax_mismatch");
    expect(codes).toContain("total_mismatch");
  });

  test("un término fijo al mes se pasa a €/día y se comprueba por meses", () => {
    const monthly = normalizeGasReading(
      invoice({
        fixedTermLines: [{ days: null, pricePerDay: null, originalPrice: { unit: "mes", price: 8.17, months: 2 }, amount: 16.34 }],
      }),
    );
    expect(monthly.fixedTermLines[0].pricePerDay).toBeCloseTo((8.17 * 12) / 365, 6);
    expect(validateGasInvoice(monthly).map(({ code }) => code)).not.toContain("fixed_term_mismatch");
  });

  test("dos tipos de IVA (gas al 10 %, contador al 21 %): cuadra y las ofertas llevan el del gas", () => {
    const split = invoice({
      meterRental: { days: 61, pricePerDay: 0.02, amount: 1.22 },
      oneOffLines: [],
      otherTaxableLines: [],
      taxableBase: 105.7,
      vatLines: [
        { ratePercent: 10, base: 104.48, amount: 10.45 },
        { ratePercent: 21, base: 1.22, amount: 0.26 },
      ],
      total: 116.41,
    });
    expect(validateGasInvoice(split).filter(({ severity }) => severity === "blocking")).toEqual([]);
    expect(gasInvoiceTaxRates(split).vatRate).toBe(0.1);
    expect(toStudyExtraction(split).vat).toEqual({ ratePercent: 10, base: 105.7, amount: 10.71 });
  });

  test("el canon IRC y la cuota GTS se pagan con cualquiera: van por día con el contador, no como servicio", () => {
    const withCanon = invoice({ regulatedLines: [{ description: "Canon IRC", amount: 12.2 }], taxableBase: 172.89, vatLines: [{ ratePercent: 21, base: 172.89, amount: 36.31 }], total: 209.2 });
    expect(validateGasInvoice(withCanon).filter(({ severity }) => severity === "blocking")).toEqual([]);
    const current = gasCurrentTariff(toStudyExtraction(withCanon))!;
    expect(current.meterRentalPerDay).toBeCloseTo(0.02 + 12.2 / 61, 9);
    expect(current.prices.servicesPerYear).toBeCloseTo((9.99 * 365) / 61, 6);
  });

  test("sin consumo no hay variable: vale sin líneas de energía, y una línea de energía con kWh no cuadra", () => {
    const empty = invoice({ consumptionKwh: 0, energyLines: [], discounts: [], hydrocarbonTax: null, oneOffLines: [], otherTaxableLines: [], taxableBase: 19.52, vatLines: [{ ratePercent: 21, base: 19.52, amount: 4.1 }], total: 23.62 });
    expect(validateGasInvoice(empty).filter(({ severity }) => severity === "blocking")).toEqual([]);
    expect(gasCurrentTariff(toStudyExtraction(empty))).toBeNull();
    const bogus = { ...empty, energyLines: [{ kwh: 1, pricePerKwh: 0.67, amount: 0.67 }] };
    expect(validateGasInvoice(bogus).map(({ code }) => code)).toContain("consumption_mismatch");
  });

  test("una factura de la TUR es de precio fijo aunque la IA diga indexada", () => {
    expect(normalizeGasReading(invoice({ regulatedTur: true, pricing: "indexed" })).pricing).toBe("fixed");
  });

  test("un peaje RL.5 queda fuera", () => {
    expect(validateGasInvoice(invoice({ accessTariff: "RL.5" })).some(({ code }) => code === "unsupported_gas_tariff")).toBe(true);
  });

  test("lo que paga hoy: precios, descuento, servicios al año y sin la inspección", () => {
    const current = gasCurrentTariff(toStudyExtraction(invoice()))!;
    expect(current.prices.power).toEqual({ P1: 0.3, P2: 0 });
    expect(current.prices.energy.P1).toBeCloseTo(0.075, 9);
    expect(current.energyDiscountRates[0]).toBeCloseTo(9.26 / 92.55, 9);
    expect(current.prices.servicesPerYear).toBeCloseTo((9.99 * 365) / 61, 6);
    expect(current.meterRentalPerDay).toBeCloseTo(0.02, 9);
    expect(gasInvoiceTaxRates(invoice())).toEqual({ hydrocarbonTaxPerKwh: 0.00234, vatRate: 0.21 });
  });

  test("la forma común lleva el consumo en P1, la energía como precio único y la lectura de gas dentro", () => {
    const stored = toStudyExtraction(invoice());
    expect(stored.consumptionKwh).toEqual({ P1: 1234, P2: null, P3: null });
    expect(stored.energyLines[0].period).toBe("ALL");
    expect(stored.powerLines).toEqual([]);
    expect(stored.gas.accessTariff).toBe("RL.2");
  });
});

/** Lecturas bimestrales de un año, más en invierno. */
function readings(): ApoloSipsGasConsumptionRow[] {
  const periods = [
    ["2025-10-01", "2025-11-30", 1500],
    ["2025-12-01", "2026-01-31", 3500],
    ["2026-02-01", "2026-03-31", 2500],
    ["2026-04-01", "2026-05-31", 900],
    ["2026-06-01", "2026-07-31", 300],
    ["2026-08-01", "2026-09-30", 300],
  ] as const;
  return periods.map(([from, to, kwh]) => ({
    cups: "ES0230901000012345JM",
    fechaInicioMesConsumo: from,
    fechaFinMesConsumo: to,
    codigoTarifaPeaje: "R2",
    consumoEnWhP1: kwh * 1000,
    consumoEnWhP2: 0,
    caudalMedioEnWhdia: null,
    caudaMinimoDiario: null,
    caudaMaximoDiario: null,
    porcentajeConsumoNocturno: null,
    codigoTipoLectura: null,
  }));
}

const point = (overrides: Partial<ApoloSipsGasPointSupplyRow> = {}) =>
  ({
    codigoProvinciaPS: "28",
    codigoPostalPS: "28001",
    municipioPS: "079",
    desmunicipioPS: "Madrid",
    codigoPeajeEnVigor: "R2",
    derechoTUR: "S",
    nombreEmpresaDistribuidora: "Madrileña Red de Gas",
    ...overrides,
  }) as ApoloSipsGasPointSupplyRow;

describe("el suministro de gas del SIPS", () => {
  test("un año de lecturas bimestrales, con el peaje del SIPS y el derecho a TUR", () => {
    const supply = buildGasSupply({ invoice: { accessTariff: "RL.2" }, sipsPoint: point(), sipsConsumption: readings() });
    expect(supply.energy).toBe("gas");
    expect(supply.annualKwh).toEqual({ P1: 9000, P2: 0, P3: 0 });
    expect(supply.sipsMonths).toBe(6);
    expect(supply.gas).toEqual({ accessTariff: "RL.2", tariffSource: "sips", consumptionTariff: null, turEligible: true });
    expect(supply.location).toEqual({ postalCode: "28001", municipality: "Madrid", province: "Madrid" });
    expect(supply.power).toBeNull();
  });

  test("si el peaje en vigor no es el de su consumo, se avisa con el que le corresponde", () => {
    const supply = buildGasSupply({ invoice: { accessTariff: null }, sipsPoint: point({ codigoPeajeEnVigor: "R1" }), sipsConsumption: readings() });
    expect(supply.gas?.accessTariff).toBe("RL.1");
    expect(supply.gas?.consumptionTariff).toBe("RL.2");
  });

  test("un punto de planta satélite (RLPS) no se compara", () => {
    expect(() => buildGasSupply({ invoice: { accessTariff: null }, sipsPoint: point({ codigoPeajeEnVigor: "S2" }), sipsConsumption: readings() })).toThrow(/planta satélite/);
  });

  test("sin un año de lecturas no hay estudio", () => {
    expect(() => buildGasSupply({ invoice: { accessTariff: "RL.2" }, sipsPoint: point(), sipsConsumption: readings().slice(0, 3) })).toThrow(
      SupplyUnavailableError,
    );
  });
});

function gasOffer(id: string, overrides: Partial<StoredRatePrice> = {}): ActiveOfferPrice {
  return {
    comercializadoraId: "COM-1",
    comercializadoraName: "Gana Energía",
    versionId: "v1",
    versionValidFrom: "2026-10-01",
    price: {
      id,
      versionId: "v1",
      rateId: `rate-${id}`,
      rateName: `Gas ${id}`,
      catalogRateId: null,
      accessTariff: "RL.2",
      pricing: "fixed",
      level: null,
      territory: "peninsula",
      channel: null,
      clientSegment: null,
      minPowerKw: null,
      maxPowerKw: null,
      minAnnualKwh: null,
      maxAnnualKwh: null,
      supplyStartFrom: null,
      supplyStartTo: null,
      termMonths: 12,
      powerMode: "fixed",
      powerMarginPerKwYear: null,
      power: { P1: 0.28, P2: 0 },
      energy: { P1: 0.065, P2: 0.065, P3: 0.065 },
      includesAncillaryServices: true,
      feeEnergyMinPerMwh: null,
      feeEnergyMaxPerMwh: null,
      feePowerAllowed: false,
      discounts: [],
      sourceExcerpt: null,
      sourceLocation: null,
      ...overrides,
    },
  };
}

const rule = (overrides: Partial<CommissionRule>): CommissionRule => ({
  id: "r",
  comercializadoraId: "COM-1",
  rateId: null,
  product: null,
  accessTariff: null,
  pricing: null,
  level: null,
  channel: null,
  minAnnualKwh: null,
  maxAnnualKwh: null,
  minKw: null,
  maxKw: null,
  ruleType: "fixed",
  feeBase: "energy",
  amount: 0,
  minAmount: null,
  validFrom: "2026-01-01",
  validTo: null,
  ...overrides,
});

describe("el ranking de gas", () => {
  const supply = buildGasSupply({ invoice: { accessTariff: "RL.2" }, sipsPoint: point(), sipsConsumption: readings() });
  const current = gasCurrentTariff(toStudyExtraction(invoice()));

  test("con el consumo estimado, la comisión por tramos va con el consumo real del SIPS", () => {
    const estimated = { ...supply, annualKwh: { P1: 3000, P2: 0, P3: 0 }, estimate: { reason: "chosen" as const, invoiceDays: 61 }, referenceAnnualKwh: 9000 };
    const ranking = rankStudy({
      supply: estimated,
      current,
      offers: [gasOffer("a")],
      rules: [rule({ id: "bajo", amount: 30, energy: "gas", maxAnnualKwh: 5000 }), rule({ id: "alto", amount: 70, energy: "gas", minAnnualKwh: 5000 })],
      regulated: getRegulatedParams("2026-10-15"),
      gasRegulated: regulated,
      options: { date: "2026-10-15", channel: null, feeEnergyPerMwh: null, order: "savings" },
    });
    expect(ranking.offers[0].commission).toBe(70);
    // El coste, con el consumo estimado.
    expect(ranking.offers[0].cost.energy.total).toBe(195);
  });

  test("solo las tarifas de su peaje, con el coste de gas y la comisión de gas; sin la TUR", () => {
    const ranking = rankStudy({
      supply,
      current,
      offers: [
        gasOffer("a"),
        gasOffer("b", { accessTariff: "RL.1" }),
        gasOffer("c", { energy: { P1: 0.06, P2: 0.06, P3: 0.06 } }),
        // El gas indexado no se oferta.
        gasOffer("d", { pricing: "indexed", energy: { P1: 0.01, P2: 0.01, P3: 0.01 } }),
      ],
      rules: [
        rule({ id: "luz", amount: 100 }),
        rule({ id: "gas", amount: 40, energy: "gas", accessTariff: "RL.2" }),
      ],
      regulated: getRegulatedParams("2026-10-15"),
      gasRegulated: regulated,
      options: { date: "2026-10-15", channel: null, feeEnergyPerMwh: null, order: "savings" },
    });
    expect(ranking.offers.map(({ key }) => key)).toEqual(["c", "a"]);
    const best = ranking.offers[0];
    expect(best.cost.kind).toBe("gas");
    expect(best.cost.energy.total).toBe(540);
    expect(best.cost.power.total).toBe(102.2);
    expect(best.cost.electricityTax).toBe(21.06);
    // La regla de luz sin tarifa no paga una oferta de gas.
    expect(best.commission).toBe(40);
    expect(best.needsAncillary).toBe(false);
    expect(ranking.current?.kind).toBe("gas");
    expect(best.savings).toBeGreaterThan(0);
    // Beenergy no quiere enseñar la TUR: el ranking no la calcula.
    expect("tur" in ranking).toBe(false);
  });

});
