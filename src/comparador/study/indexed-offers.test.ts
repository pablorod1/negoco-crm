// @vitest-environment node
import { describe, expect, test } from "vitest";
import { getRegulatedParams } from "@/comparador/engine/regulated";
import { historyForRate, type IndexHistoryRow } from "@/comparador/rates/index-history";
import type { ActiveOfferPrice } from "@/comparador/rates/repository";
import type { CommissionRule, StoredRatePrice } from "@/comparador/rates/types";
import { historyEnergyPrices } from "./indexed";
import { rankStudy } from "./ranking";
import type { StudySupply } from "./supply";

const supply: StudySupply = {
  contractedKw: { P1: 4.6, P2: 4.6 },
  annualKwh: { P1: 400, P2: 200, P3: 100 },
  consumptionSource: "sips",
  sipsMonths: 2,
  territory: "peninsula",
  territorySource: "sips",
  power: null,
  readings: [
    { from: "2025-11-01", to: "2026-04-30", kwh: { P1: 100, P2: 100, P3: 100 } },
    { from: "2026-05-01", to: "2026-10-31", kwh: { P1: 300, P2: 100, P3: 0 } },
  ],
};

const MONTHS = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

/** Invierno a 0,10 €/kWh en punta, verano a 0,20; llano y valle iguales todo el año. */
function history(rateId: string | null = null, months = MONTHS): IndexHistoryRow[] {
  return months.map((month, index) => ({
    id: `${rateId ?? "all"}-${month}`,
    comercializadoraId: "COM-1",
    rateId,
    accessTariff: "2.0TD",
    month,
    energy: { P1: index < 6 ? 0.1 : 0.2, P2: 0.15, P3: 0.08 },
    source: "manual",
    ingestId: null,
    updatedAt: "2026-10-15",
  }));
}

function offer(id: string, overrides: Partial<StoredRatePrice> = {}): ActiveOfferPrice {
  return {
    comercializadoraId: "COM-1",
    comercializadoraName: "Gana Energía",
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

const indexed = offer("omie", { pricing: "indexed", energy: null, feeEnergyMinPerMwh: 10, feeEnergyMaxPerMwh: 20 });

const feeShare = (pricing: CommissionRule["pricing"], amount: number): CommissionRule => ({
  id: `r-${pricing}`,
  comercializadoraId: "COM-1",
  rateId: null,
  product: null,
  pricing,
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
  amount,
  validFrom: "2026-01-01",
  validTo: null,
});

const rank = (rows: IndexHistoryRow[], rules: CommissionRule[] = [], studySupply = supply) =>
  rankStudy({
    supply: studySupply,
    current: null,
    offers: [offer("fija", { feeEnergyMinPerMwh: 10, feeEnergyMaxPerMwh: 20 }), indexed],
    rules,
    regulated: getRegulatedParams("2026-10-15"),
    options: { date: "2026-10-15", channel: null, feeEnergyPerMwh: null, order: "savings" },
    indexHistory: rows,
  });

describe("indexed offers", () => {
  test("each SIPS reading is charged at the history of its months, weighted by its kWh", () => {
    const prices = historyEnergyPrices(historyForRate(history(), "COM-1", "rate-omie"), supply.readings!);
    if (!prices || "missing" in prices) throw new Error("expected prices");
    // Punta: 100 kWh a 0,10 y 300 a 0,20.
    expect(prices.energy.P1).toBeCloseTo(0.175, 10);
    expect(prices.energy.P2).toBeCloseTo(0.15, 10);
    // Valle: solo consumió en invierno.
    expect(prices.energy.P3).toBeCloseTo(0.08, 10);
    expect(prices).toMatchObject({ from: "2025-11", to: "2026-10" });
  });

  test("a reading that crosses two months takes each month by its days", () => {
    const months = new Map([
      ["2026-01", { P1: 0.1, P2: 0.1, P3: 0.1 }],
      ["2026-02", { P1: 0.2, P2: 0.2, P3: 0.2 }],
    ]);
    // Del 22 de enero al 10 de febrero: 10 días de enero y 10 de febrero.
    const prices = historyEnergyPrices(months, [{ from: "2026-01-22", to: "2026-02-10", kwh: { P1: 10, P2: 10, P3: 10 } }]);
    if (!prices || "missing" in prices) throw new Error("expected prices");
    expect(prices.energy.P1).toBeCloseTo(0.15, 10);
  });

  test("an indexed offer is ranked with the history energy and the fee on top", () => {
    const ranking = rank(history());
    const omie = ranking.offers.find(({ key }) => key === "omie")!;
    expect(omie.pricing).toBe("indexed");
    expect(omie.indexHistory).toEqual({ from: "2025-11", to: "2026-10" });
    // 0,175 €/kWh del histórico + 10 €/MWh de fee.
    expect(omie.prices.energy.P1).toBeCloseTo(0.185, 10);
    expect(ranking.offers.find(({ key }) => key === "fija")!.pricing).toBe("fixed");
    expect(ranking.withoutHistory).toEqual([]);
  });

  test("its own history wins over the supplier's for the same month", () => {
    const own = history("rate-omie").map((row) => ({ ...row, energy: { P1: 0.3, P2: 0.3, P3: 0.3 } }));
    const omie = rank([...history(), ...own]).offers.find(({ key }) => key === "omie")!;
    expect(omie.prices.energy.P2).toBeCloseTo(0.31, 10);
  });

  test("without the history of every month of consumption it is not offered, and says which", () => {
    const ranking = rank(history(null, MONTHS.filter((month) => month !== "2026-03")));
    expect(ranking.offers.map(({ key }) => key)).toEqual(["fija"]);
    expect(ranking.withoutHistory).toEqual([{ comercializadoraName: "Gana Energía", productName: "Tarifa omie", missing: ["2026-03"] }]);
    // Un estudio sin lecturas guardadas no puede ofertar indexadas.
    expect(rank(history(), [], { ...supply, readings: undefined }).withoutHistory[0].missing).toEqual([]);
  });

  test("commissions of the indexed section only apply to indexed offers", () => {
    const ranking = rank(history(), [feeShare("fixed", 50), feeShare("indexed", 65)]);
    // 700 kWh × 10 €/MWh = 7 € de fee.
    expect(ranking.offers.find(({ key }) => key === "fija")!.commission).toBe(3.5);
    expect(ranking.offers.find(({ key }) => key === "omie")!.commission).toBe(4.55);
  });
});
