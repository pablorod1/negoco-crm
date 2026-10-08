// @vitest-environment node
import { describe, expect, test } from "vitest";
import { getRegulatedParams } from "@/comparador/engine/regulated";
import type { CurrentTariff } from "@/comparador/extraction/current-tariff";
import type { ActiveOfferPrice } from "@/comparador/rates/repository";
import type { CommissionRule, StoredRatePrice } from "@/comparador/rates/types";
import type { ApoloSipsElectricityConsumptionRow } from "@/integrations/apolo-sips/types";
import { layoutLines } from "./invoice-text";
import { rankStudy } from "./ranking";
import { detectSupplierInText } from "./supplier";
import { annualKwhFromSips, territoryFromProvince, type StudySupply } from "./supply";

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
