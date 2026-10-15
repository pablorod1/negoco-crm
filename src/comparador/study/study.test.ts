// @vitest-environment node
import { describe, expect, test } from "vitest";
import { getRegulatedParams } from "@/comparador/engine/regulated";
import type { CurrentTariff } from "@/comparador/extraction/current-tariff";
import type { ActiveOfferPrice } from "@/comparador/rates/repository";
import type { CommissionRule, StoredRatePrice } from "@/comparador/rates/types";
import type { ApoloSipsElectricityConsumptionRow } from "@/integrations/apolo-sips/types";
import { indexedEnergyPrices, marginOverMarket } from "./indexed";
import { layoutLines } from "./invoice-text";
import { rankStudy, rateAudience } from "./ranking";
import { detectSupplierInText } from "./supplier";
import { annualKwhFromSips, estimatedAnnualKwh, territoryFromProvince, type StudySupply } from "./supply";

describe("invoice text", () => {
  test("pieces at the same height make one line, with a space where there is a gap", () => {
    // Una tabla de precios: pdf.js da cada cifra suelta.
    const lines = layoutLines([
      { text: "P2", x: 200, y: 500, width: 12 },
      { text: "Energía", x: 50, y: 520, width: 40 },
      { text: "0,164866", x: 100, y: 500.8, width: 40 },
      { text: "0,196967", x: 150, y: 500, width: 40 },
      { text: "P1", x: 50, y: 500, width: 12 },
    ]);
    expect(lines).toEqual(["Energía", "P1 0,164866 0,196967 P2"]);
  });
});

describe("supply", () => {
  const month = (from: string, to: string, p1: number, demandW = 3200): ApoloSipsElectricityConsumptionRow =>
    ({
      fechaInicioMesConsumo: from,
      fechaFinMesConsumo: to,
      consumoEnergiaActivaEnWhP1: p1 * 1000,
      consumoEnergiaActivaEnWhP2: 50_000,
      consumoEnergiaActivaEnWhP3: 100_000,
      potenciaDemandadaEnWP1: demandW,
    }) as ApoloSipsElectricityConsumptionRow;

  test("12 months of SIPS give the annual consumption and the maximum demand", () => {
    const rows = Array.from({ length: 14 }, (_, index) => {
      const start = new Date(Date.UTC(2025, 8 + index, 1));
      const end = new Date(Date.UTC(2025, 9 + index, 0));
      return month(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), 100, index === 13 ? 4800 : 3200);
    });
    const result = annualKwhFromSips(rows)!;
    if ("insufficient" in result) throw new Error("expected a full year");
    expect(result.months).toBe(12);
    expect(result.annualKwh.P1).toBeGreaterThanOrEqual(1199);
    expect(result.annualKwh.P1).toBeLessThanOrEqual(1203);
    expect(Math.max(...result.maxDemandKw)).toBe(4.8);
  });

  test("chained readings (one starts the day the previous ends) count each day once", () => {
    const ends = ["2025-04-13", "2025-05-14", "2025-06-12", "2025-07-13", "2025-08-17", "2025-09-10", "2025-10-13", "2025-11-11", "2025-12-08", "2026-01-13", "2026-02-10", "2026-03-11", "2026-04-13"];
    const rows = ends.slice(1).map((to, index) => month(ends[index], to, 100));
    const result = annualKwhFromSips(rows)!;
    if ("insufficient" in result) throw new Error("expected a full year");
    expect(result.days).toBe(365);
    expect(result.annualKwh.P1).toBe(1200);
  });

  test("less than a year of SIPS readings is not stretched to a year", () => {
    const rows = Array.from({ length: 5 }, (_, index) => {
      const start = new Date(Date.UTC(2026, 4 + index, 1));
      const end = new Date(Date.UTC(2026, 5 + index, 0));
      return month(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), 100);
    });
    expect(annualKwhFromSips(rows)).toMatchObject({ insufficient: true, months: 5 });
    expect(annualKwhFromSips([])).toBeNull();
  });

  test("the province of the supply point gives the territory", () => {
    expect(territoryFromProvince("07")).toBe("baleares");
    expect(territoryFromProvince("38")).toBe("canarias");
    expect(territoryFromProvince("51")).toBe("ceuta_melilla");
    expect(territoryFromProvince("28")).toBe("peninsula");
    expect(territoryFromProvince(null)).toBeNull();
  });
});

describe("ranking", () => {
  const supply: StudySupply = {
    contractedKw: { P1: 4.6, P2: 4.6 },
    annualKwh: { P1: 800, P2: 900, P3: 1300 },
    consumptionSource: "sips",
    sipsMonths: 12,
    territory: "peninsula",
    territorySource: "sips",
    power: null,
  };
  const current: CurrentTariff = {
    prices: { power: { P1: 0.12, P2: 0.05 }, energy: { P1: 0.28, P2: 0.2, P3: 0.16 } },
    energyDiscountRates: [],
    meterRentalPerDay: 0.026667,
  };

  function offer(id: string, overrides: Partial<StoredRatePrice> = {}): ActiveOfferPrice {
    return {
      comercializadoraId: "COM-1",
      comercializadoraName: "Quimera",
      versionId: "v1",
      versionValidFrom: "2026-10-01",
      price: {
        id,
        versionId: "v1",
        rateId: `rate-${id}`,
        rateName: `Tarifa ${id}`,
        catalogRateId: null,
        accessTariff: "2.0TD",
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
        power: { P1: 0.09, P2: 0.04 },
        energy: { P1: 0.2, P2: 0.15, P3: 0.12 },
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

  const rule: CommissionRule = {
    id: "r1",
    comercializadoraId: "COM-1",
    rateId: null,
    product: null,
    minKw: null,
    maxKw: null,
    minAmount: null,
    accessTariff: "2.0TD",
    level: null,
    channel: null,
    minAnnualKwh: null,
    maxAnnualKwh: null,
    ruleType: "fee_share",
    feeBase: "energy",
    amount: 50,
    validFrom: "2026-01-01",
    validTo: null,
  };

  const rank = (options: Partial<Parameters<typeof rankStudy>[0]["options"]> = {}) =>
    rankStudy({
      supply,
      current,
      offers: [
        offer("cara", { energy: { P1: 0.32, P2: 0.25, P3: 0.2 } }),
        offer("barata"),
        offer("canarias", { territory: "canarias" }),
        offer("fee", { feeEnergyMinPerMwh: 5, feeEnergyMaxPerMwh: 20 }),
        offer("grande", { minPowerKw: 10 }),
      ],
      rules: [rule],
      regulated: getRegulatedParams("2026-10-07"),
      options: { date: "2026-10-07", channel: "acquisition", feeEnergyPerMwh: null, order: "savings", ...options },
    });

  test("only eligible offers, cheapest first, with savings against today's bill", () => {
    const ranking = rank();
    expect(ranking.ineligible).toBe(2);
    expect(ranking.offers.map(({ key }) => key)).toEqual(["barata", "fee", "cara"]);
    const [best] = ranking.offers;
    expect(best.savings).toBeCloseTo(ranking.current!.total - best.cost.total, 2);
    expect(best.savings!).toBeGreaterThan(0);
    expect(ranking.offers.at(-1)!.savings!).toBeLessThan(0);
  });

  test("the fee stays inside each rate's range and drives a fee-share commission", () => {
    const atMinimum = rank().offers.find(({ key }) => key === "fee")!;
    expect(atMinimum.feeEnergyPerMwh).toBe(5);
    // 3.000 kWh × 5 €/MWh × 50 % = 7,50 €.
    expect(atMinimum.commission).toBe(7.5);

    const capped = rank({ feeEnergyPerMwh: 40 }).offers.find(({ key }) => key === "fee")!;
    expect(capped.feeEnergyPerMwh).toBe(20);
    expect(capped.commission).toBe(30);
    expect(capped.cost.total).toBeGreaterThan(atMinimum.cost.total);

    // Una tarifa sin horquilla no lleva fee.
    expect(rank({ feeEnergyPerMwh: 40 }).offers.find(({ key }) => key === "barata")!.feeEnergyPerMwh).toBe(0);
  });

  test("ordering by commission puts the best paid first", () => {
    const ranking = rank({ order: "commission", feeEnergyPerMwh: 20 });
    expect(ranking.offers[0].key).toBe("fee");
  });

  const only = (price: ActiveOfferPrice, options: Partial<Parameters<typeof rankStudy>[0]["options"]> = {}, currentTariff: CurrentTariff | null = current) =>
    rankStudy({
      supply,
      current: currentTariff,
      offers: [price],
      rules: [],
      regulated: getRegulatedParams("2026-10-07"),
      options: { date: "2026-10-07", channel: null, feeEnergyPerMwh: null, order: "savings", ...options },
    });

  test("rate discounts lower the final price; a conditional one can be left out", () => {
    const plain = only(offer("base")).offers[0];
    const withDiscount = offer("dto", { discounts: [{ kind: "other", value: null, months: null, conditional: true, text: "15% s/Te (+5% PyS Tier 1)" }] });
    const [first] = only(withDiscount).offers;
    // 15 % y 5 % sobre la energía.
    expect(first.discountParts.map(({ amount }) => amount)).toEqual([
      -Math.round(plain.cost.energy.total * 15) / 100,
      -Math.round(plain.cost.energy.total * 5) / 100,
    ]);
    expect(first.cost.total).toBeLessThan(plain.cost.total);

    const without = only(withDiscount, { excludedDiscounts: [first.discountParts[1].id] }).offers[0];
    expect(without.discountParts[1]).toMatchObject({ applied: false, amount: 0 });
    expect(without.cost.total).toBeGreaterThan(first.cost.total);
  });

  test("each kind of customer sees its rates; those without a segment, everyone", () => {
    const home = offer("hogar", { rateName: "Tarifa Hogar 24h" });
    const business = offer("pyme", { clientSegment: "Pyme" });
    const any = offer("todos");
    const names = (customerType: "particular" | "autonomo" | "empresa" | null) =>
      rankStudy({
        supply,
        current,
        offers: [home, business, any],
        rules: [],
        regulated: getRegulatedParams("2026-10-07"),
        options: { date: "2026-10-07", channel: null, feeEnergyPerMwh: null, order: "savings", customerType },
      }).offers.map(({ key }) => key).sort();
    expect(names("particular")).toEqual(["hogar", "todos"]);
    expect(names("empresa")).toEqual(["pyme", "todos"]);
    expect(names("autonomo")).toEqual(["hogar", "pyme", "todos"]);
    expect(names(null)).toEqual(["hogar", "pyme", "todos"]);
  });

  test("a rate without ancillary services is offered marked until SSAA are applied", () => {
    const noSsaa = offer("sin-ssaa", { includesAncillaryServices: false });
    const unapplied = only(noSsaa);
    expect(unapplied.withoutAncillary).toBe(1);
    expect(unapplied.offers[0]).toMatchObject({ needsAncillary: true, ancillarySimulated: false });
    expect(unapplied.offers[0].cost.ancillary ?? 0).toBe(0);

    const average = only(noSsaa, { ancillary: { averagePerMwh: 10, monthlyPerMwh: null } }).offers[0];
    // 3.000 kWh × 10 €/MWh.
    expect(average.cost.ancillary).toBe(30);
    expect(average.ancillarySimulated).toBe(true);
    expect(average.needsAncillary).toBe(false);

    // Por mes: cada lectura con su mes. Enero a 40 y el resto a 0.
    const withReadings: StudySupply = {
      ...supply,
      readings: [
        { from: "2026-01-01", to: "2026-01-31", kwh: { P1: 100, P2: 100, P3: 100 } },
        { from: "2026-02-01", to: "2026-12-31", kwh: { P1: 700, P2: 800, P3: 1200 } },
      ],
    };
    const monthly = rankStudy({
      supply: withReadings,
      current,
      offers: [noSsaa],
      rules: [],
      regulated: getRegulatedParams("2026-10-07"),
      options: {
        date: "2026-10-07",
        channel: null,
        feeEnergyPerMwh: null,
        order: "savings",
        ancillary: { averagePerMwh: null, monthlyPerMwh: [40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      },
    }).offers[0];
    expect(monthly.cost.ancillary).toBe(12);
  });

  test("a flat rate costs its fee for 12 months plus VAT", () => {
    const flat: CurrentTariff = {
      prices: { power: { P1: 0, P2: 0 }, energy: { P1: 0, P2: 0, P3: 0 } },
      energyDiscountRates: [],
      meterRentalPerDay: 0,
      flatAnnualFee: 348,
    };
    const ranking = only(offer("base"), {}, flat);
    expect(ranking.current).toMatchObject({ flatFee: 348, vat: 73.08, total: 421.08 });
    expect(ranking.offers[0].savings).toBeCloseTo(421.08 - ranking.offers[0].cost.total, 2);
  });
});

describe("indexed tariff", () => {
  const supply: StudySupply = {
    contractedKw: { P1: 4.6, P2: 4.6 },
    annualKwh: { P1: 600, P2: 600, P3: 600 },
    consumptionSource: "sips",
    sipsMonths: 2,
    territory: "peninsula",
    territorySource: "sips",
    power: null,
    readings: [
      { from: "2026-01-01", to: "2026-06-30", kwh: { P1: 100, P2: 100, P3: 100 } },
      { from: "2026-07-01", to: "2026-12-31", kwh: { P1: 300, P2: 100, P3: 0 } },
    ],
    market: {
      source: "omie",
      readings: [
        { P1: 50, P2: 40, P3: 30 },
        { P1: 150, P2: 140, P3: 130 },
      ],
      invoice: { P1: 100, P2: 90, P3: 80 },
      invoicePeriod: { from: "2026-08-01", to: "2026-08-31" },
      fetchedAt: "2026-10-14T00:00:00.000Z",
    },
  };

  test("the invoice margin over OMIE is added to the market of each SIPS reading", () => {
    const prices = indexedEnergyPrices({ P1: 0.2, P2: 0.18, P3: 0.15 }, supply)!;
    // P1: margen 0,2 − 0,1 = 0,1; mercado (100×50 + 300×150)/400 = 125 €/MWh.
    expect(prices.P1).toBeCloseTo(0.225, 10);
    // P2: margen 0,09; mercado (40 + 140)/2 = 90.
    expect(prices.P2).toBeCloseTo(0.18, 10);
    // P3: solo consumió en la primera lectura.
    expect(prices.P3).toBeCloseTo(0.07 + 0.03, 10);
    expect(marginOverMarket({ P1: 0.2, P2: 0.18, P3: 0.15 }, supply, { P1: 10, P2: 10, P3: 0 })).toBeCloseTo(0.095, 10);
  });

  test("without readings or market there is no indexed price", () => {
    expect(indexedEnergyPrices({ P1: 0.2, P2: 0.18, P3: 0.15 }, { ...supply, market: null })).toBeNull();
    expect(indexedEnergyPrices({ P1: 0.2, P2: 0.18, P3: 0.15 }, { ...supply, readings: undefined })).toBeNull();
  });
});

describe("supplier in the invoice text", () => {
  const suppliers = [
    { id: "COM-005", name: "Eleia" },
    { id: "COM-010", name: "Iberdrola" },
    { id: "COM-011", name: "Naturgy" },
    { id: "COM-012", name: "VM" },
  ];

  test("finds the only supplier named in the text, not the distributor", () => {
    const text =
      "Distribuidora: Iberdrola Distribución Eléctrica\nLe informamos que Eleia Energía está adherida a la Junta Arbitral de Consumo";
    expect(detectSupplierInText(text, suppliers)?.id).toBe("COM-005");
  });

  test("does not guess with two suppliers or a short name inside other words", () => {
    expect(detectSupplierInText("Eleia y Naturgy", suppliers)).toBeNull();
    expect(detectSupplierInText("consumo VM 2 kWh", suppliers)).toBeNull();
  });
});

describe("rateAudience", () => {
  test("reads the segment or, without it, the product name", () => {
    expect(rateAudience("Doméstico", "Fijo 24h")).toBe("hogar");
    expect(rateAudience(null, "Tarifa Negocios Plus")).toBe("negocio");
    expect(rateAudience(null, "Plan Estable PYME")).toBe("negocio");
    expect(rateAudience(null, "FIJO POWER PLUS_v2603")).toBeNull();
  });
});

describe("estimatedAnnualKwh", () => {
  const base = { billingPeriod: { from: "2026-08-01", to: "2026-08-31", days: 31 }, energyLines: [] };
  test("el consumo por periodo de la factura llevado a 365 días", () => {
    expect(estimatedAnnualKwh({ ...base, consumptionKwh: { P1: 62, P2: 62, P3: 124 } })).toEqual({ P1: 730, P2: 730, P3: 1460 });
  });
  test("con solo el total (precio único), repartido como una 2.0TD doméstica", () => {
    const annual = estimatedAnnualKwh({
      ...base,
      consumptionKwh: { P1: null, P2: null, P3: null },
      energyLines: [
        { period: "ALL", kwh: 310, pricePerKwh: 0.1, amount: 31 },
        { period: "ALL", kwh: 310, pricePerKwh: 0.03, amount: 9.3 },
      ],
    })!;
    expect(annual.P1 + annual.P2 + annual.P3).toBe(3650);
  });
  test("sin días ni consumo, no hay estimación", () => {
    expect(estimatedAnnualKwh({ billingPeriod: null, consumptionKwh: { P1: 10, P2: 0, P3: 0 }, energyLines: [] })).toBeNull();
  });
});
