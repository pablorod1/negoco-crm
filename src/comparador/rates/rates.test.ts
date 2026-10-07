import { describe, expect, test } from "vitest";
import { computeCommission, type CommissionRuleForEngine } from "@/comparador/engine/commission";
import { getRegulatedParams } from "@/comparador/engine/regulated";
import { buildDiff, type ResolvedRow } from "./diff";
import { isEligible, toTariffPrices } from "./engine-prices";
import { matchProducts } from "./match";
import { normalizeName } from "./names";
import {
  appearsInText,
  energyToPerKwh,
  numbersInText,
  powerToPerDay,
  toProposedRates,
} from "./normalize";
import type { ExtractedRate } from "./schema";
import { freshness, medianDecisionHours } from "./staleness";
import type { StoredRatePrice } from "./types";
import { validateProposedRates } from "./validate";

function extracted(overrides: Partial<ExtractedRate> = {}): ExtractedRate {
  return {
    productName: "Unicornio",
    accessTariff: "2.0TD",
    pricing: "fixed",
    level: null,
    territory: null,
    channel: null,
    segment: null,
    minKw: null,
    maxKw: null,
    minKwh: null,
    maxKwh: null,
    startFrom: null,
    startTo: null,
    months: null,
    powerMode: "fixed",
    powerUnit: "eur_kw_day",
    powerP1: 0.0896,
    powerP2: 0.07048,
    powerMargin: null,
    energyUnit: "eur_kwh",
    energyP1: 0.24755,
    energyP2: 0.17927,
    energyP3: 0.15329,
    singlePrice: false,
    ancillaryIncluded: true,
    feeMinMwh: null,
    feeMaxMwh: null,
    feeOnPower: false,
    discounts: [],
    ...overrides,
  };
}

// Fragmento real del anexo de Quimera (octubre de 2026).
const UNICORNIO_TEXT = `TARIFA 2.0TD P1 P2 P3
Energía (€/kWh) sin SS.AA. 0,22755 0,15927 0,13329
Energía (€/kWh) con SS.AA. 0,24755 0,17927 0,15329
Potencia pers. (€/kW día) 0,08960 0,07048`;

describe("unit conversion", () => {
  test("power to €/kW·día as the annexes print it", () => {
    // Endesa: 38,704416 €/kW·año = 3,225368 €/kW·mes = 0,106039 €/kW·día.
    expect(powerToPerDay(38.704416, "eur_kw_year")).toBeCloseTo(0.106039, 6);
    expect(powerToPerDay(3.225368, "eur_kw_month")).toBeCloseTo(0.106039, 6);
    expect(powerToPerDay(0.106039, "eur_kw_day")).toBe(0.106039);
  });

  test("energy to €/kWh", () => {
    // EDP publica céntimos de euro por kWh.
    expect(energyToPerKwh(26.6321, "cent_kwh")).toBeCloseTo(0.266321, 9);
    expect(energyToPerKwh(150, "eur_mwh")).toBe(0.15);
  });

  test("single-price products never end up with zero energy", () => {
    // Repsol escribe «0.1399 0.0000 0.0000» en sus tarifas de precio único.
    const [row] = toProposedRates({
      rates: [
        extracted({ energyP1: 0.1399, energyP2: 0, energyP3: 0, singlePrice: true }),
      ],
    });
    expect(row.energy).toEqual({ P1: 0.1399, P2: 0.1399, P3: 0.1399 });
  });

  test("regulated power keeps no price and remembers the margin", () => {
    const [row] = toProposedRates({
      rates: [
        extracted({
          powerMode: "regulated_plus",
          powerUnit: null,
          powerP1: null,
          powerP2: null,
          powerMargin: 3,
        }),
      ],
    });
    expect(row).toMatchObject({
      powerMode: "regulated_plus",
      power: null,
      powerMarginPerKwYear: 3,
      powerStated: true,
    });
  });
});

describe("numbers in the source text", () => {
  test("reads comma and dot decimals and trailing zeros", () => {
    const numbers = numbersInText("0,155804 · 43.990000 · 1.000 kWh · 27,704413");
    expect(appearsInText(0.155804, numbers)).toBe(true);
    expect(appearsInText(43.99, numbers)).toBe(true);
    expect(appearsInText(1000, numbers)).toBe(true);
    expect(appearsInText(27.704413, numbers)).toBe(true);
    expect(appearsInText(0.15580, numbers)).toBe(false);
  });

  test("splits spreadsheet cells glued by commas", () => {
    const numbers = numbersInText("2.0TD_2 Comunidad Exclusivo,43.990000,28.990000,,,,,0.215000");
    expect(appearsInText(43.99, numbers)).toBe(true);
    expect(appearsInText(28.99, numbers)).toBe(true);
    expect(appearsInText(0.215, numbers)).toBe(true);
  });
});

describe("validateProposedRates", () => {
  const options = { sourceText: UNICORNIO_TEXT, partialUpdate: false, validFrom: "2026-10-01" };

  test("a faithful extraction has no blocking issues", () => {
    const rates = toProposedRates({ rates: [extracted()] }, UNICORNIO_TEXT);
    expect(validateProposedRates(rates, options).filter(({ severity }) => severity === "blocking")).toEqual([]);
    // El fragmento de origen lo busca nuestro código, no la IA.
    expect(rates[0].sourceExcerpt).toBe("Energía (€/kWh) con SS.AA. 0,24755 0,17927 0,15329");
  });

  test("a figure that is not in the document blocks the ingest", () => {
    const rates = toProposedRates({
      rates: [extracted({ energyP1: 0.24775 })],
    });
    const issues = validateProposedRates(rates, options);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "blocking", code: "not_in_source" }),
    );
  });

  test("a wrong unit is caught by the plausible ranges", () => {
    // 0,0896 €/kW·día leído como €/kW·año da una potencia ridícula.
    const rates = toProposedRates({
      rates: [extracted({ powerUnit: "eur_kw_year" })],
    });
    expect(validateProposedRates(rates, options)).toContainEqual(
      expect.objectContaining({ code: "power_out_of_range" }),
    );
  });

  test("missing power blocks a full document but not a partial update", () => {
    const rates = toProposedRates({
      rates: [extracted({ powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null })],
    });
    expect(validateProposedRates(rates, options)).toContainEqual(
      expect.objectContaining({ code: "missing_power" }),
    );
    expect(
      validateProposedRates(rates, { ...options, partialUpdate: true }).some(
        ({ code }) => code === "missing_power",
      ),
    ).toBe(false);
  });

  test("indexed and non-2.0TD rows are informational, not stored", () => {
    const rates = toProposedRates({
      rates: [extracted({ pricing: "indexed" }), extracted({ accessTariff: "3.0TD" })],
    });
    const issues = validateProposedRates(rates, options);
    expect(issues.filter(({ code }) => code === "out_of_scope_row")).toHaveLength(2);
    expect(issues).toContainEqual(expect.objectContaining({ code: "no_rates" }));
  });

  test("images cannot be verified and say so", () => {
    const issues = validateProposedRates(toProposedRates({ rates: [extracted()] }), {
      ...options,
      sourceText: null,
    });
    expect(issues).toContainEqual(expect.objectContaining({ code: "unverifiable_source" }));
  });

  test("duplicated conditions block", () => {
    const rates = toProposedRates({ rates: [extracted(), extracted()] });
    expect(validateProposedRates(rates, options)).toContainEqual(
      expect.objectContaining({ code: "duplicate_row" }),
    );
  });
});

describe("matchProducts", () => {
  const catalog = [
    {
      id: "cat-helsinki",
      supplierKey: "nordy",
      supplierName: "Nordy",
      productName: "Helsinki",
      productKey: "helsinki",
      pricing: "fixed",
      accessTariffs: "2.0TD",
      status: "active" as const,
    },
  ];

  test("links by catalog, by alias and by tenant name", () => {
    const matches = matchProducts(
      [
        { productKey: "helsinki", productName: "Helsinki" },
        { productKey: "helsinkiplus", productName: "+Helsinki" },
        { productKey: "oslo", productName: "Oslo" },
        { productKey: "estocolmo", productName: "Estocolmo" },
      ],
      {
        tenantRates: [
          { id: "r1", name: "Helsinki", comercializadoraId: "COM-030", catalogRateId: "cat-helsinki", enabled: true },
          { id: "r2", name: "Oslo", comercializadoraId: "COM-030", catalogRateId: null, enabled: true },
        ],
        catalog,
        aliases: [{ aliasKey: "helsinkiplus", catalogRateId: "cat-helsinki" }],
      },
    );
    expect(matches.get("helsinki")).toMatchObject({ status: "linked", rateId: "r1" });
    expect(matches.get("helsinkiplus")).toMatchObject({ status: "linked", rateId: "r1" });
    expect(matches.get("oslo")).toMatchObject({ status: "linked", rateId: "r2", catalogRateId: null });
    expect(matches.get("estocolmo")).toMatchObject({ status: "new", rateId: null });
  });

  test("normalizes names like the backoffice", () => {
    expect(normalizeName("  Gana  Energía ")).toBe("ganaenergia");
    expect(normalizeName("+Helsinki I")).toBe("helsinkii");
  });
});

function stored(overrides: Partial<StoredRatePrice> = {}): StoredRatePrice {
  return {
    id: "p1",
    versionId: "v1",
    rateId: "r1",
    rateName: "Unicornio",
    catalogRateId: "cat-1",
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
    termMonths: null,
    powerMode: "fixed",
    powerMarginPerKwYear: null,
    power: { P1: 0.0896, P2: 0.07048 },
    energy: { P1: 0.2, P2: 0.17927, P3: 0.15329 },
    includesAncillaryServices: true,
    feeEnergyMinPerMwh: null,
    feeEnergyMaxPerMwh: null,
    feePowerAllowed: false,
    discounts: [],
    sourceExcerpt: null,
    sourceLocation: null,
    ...overrides,
  };
}

function resolved(overrides: Partial<ExtractedRate> = {}, rateId: string | null = "r1"): ResolvedRow {
  const [row] = toProposedRates({ rates: [extracted(overrides)] }, UNICORNIO_TEXT);
  return {
    ...row,
    match: {
      productKey: row.productKey,
      productName: row.productName,
      catalogRateId: rateId ? "cat-1" : null,
      rateId,
      status: rateId ? "linked" : "new",
    },
  };
}

describe("buildDiff", () => {
  test("flags big changes and removed rates in a full document", () => {
    const { entries, issues, versionRows } = buildDiff(
      [resolved()],
      [stored(), stored({ id: "p2", rateId: "r2", rateName: "Fénix" })],
      { partialUpdate: false },
    );
    expect(entries.map(({ kind }) => kind)).toEqual(["changed", "removed"]);
    expect(issues).toContainEqual(expect.objectContaining({ code: "big_change" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "missing_rate" }));
    expect(versionRows).toHaveLength(1);
  });

  test("a partial update keeps untouched rows and the active power", () => {
    const { entries, versionRows, issues } = buildDiff(
      [resolved({ powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null })],
      [stored({ energy: { P1: 0.24755, P2: 0.17927, P3: 0.15329 } }), stored({ id: "p2", rateId: "r2", rateName: "Fénix" })],
      { partialUpdate: true },
    );
    expect(entries.map(({ kind }) => kind)).toEqual(["unchanged", "carried"]);
    expect(versionRows).toHaveLength(2);
    expect(versionRows[0].power).toEqual({ P1: 0.0896, P2: 0.07048 });
    expect(issues).toEqual([]);
  });

  test("new products are added", () => {
    const { entries } = buildDiff([resolved({}, null)], [], { partialUpdate: false });
    expect(entries[0]).toMatchObject({ kind: "added", proposed: { match: { status: "new" } } });
  });
});

describe("engine prices and eligibility", () => {
  test("regulated power uses the 2026 tolls and charges", () => {
    const prices = toTariffPrices(
      { powerMode: "regulated_plus", powerMarginPerKwYear: 3, power: null, energy: { P1: 0.27, P2: 0.19, P3: 0.16 } },
      getRegulatedParams("2026-10-07"),
    );
    expect(prices?.power.P1).toBeCloseTo(30.704413 / 365, 9);
    expect(prices?.power.P2).toBeCloseTo(3.725423 / 365, 9);
  });

  test("power and consumption bands as the annexes write them", () => {
    const row = stored({ minPowerKw: 10, maxPowerKw: 15, maxAnnualKwh: 8000 });
    const supply = {
      maxContractedKw: 10,
      annualKwh: 5000,
      territory: "peninsula" as const,
      supplyStart: "2026-11-01",
      channel: null,
    };
    expect(isEligible(row, supply)).toBe(false);
    expect(isEligible(row, { ...supply, maxContractedKw: 10.35 })).toBe(true);
    expect(isEligible(row, { ...supply, maxContractedKw: 10.35, annualKwh: 9000 })).toBe(false);
    expect(isEligible(row, { ...supply, maxContractedKw: 12, territory: "baleares" })).toBe(false);
  });
});

describe("computeCommission", () => {
  // Modelo 2026 de Repsol para 2.0TD > 10 kW (euros por contrato).
  const rules: CommissionRuleForEngine[] = [
    { rateId: null, accessTariff: "2.0TD", level: "Agencia", channel: null, minAnnualKwh: 0, maxAnnualKwh: 10_000, ruleType: "fixed", amount: 200, validFrom: "2026-01-01", validTo: null },
    { rateId: null, accessTariff: "2.0TD", level: "Agencia", channel: null, minAnnualKwh: 10_000, maxAnnualKwh: 15_000, ruleType: "fixed", amount: 320, validFrom: "2026-01-01", validTo: null },
    { rateId: null, accessTariff: "2.0TD", level: "Estándar", channel: null, minAnnualKwh: 0, maxAnnualKwh: 10_000, ruleType: "fixed", amount: 150, validFrom: "2026-01-01", validTo: null },
    { rateId: "r9", accessTariff: null, level: null, channel: null, minAnnualKwh: null, maxAnnualKwh: null, ruleType: "fee_share", amount: 50, validFrom: "2026-01-01", validTo: null },
  ];
  const context = {
    rateId: "r1",
    accessTariff: "2.0TD",
    level: "Agencia",
    channel: null,
    annualKwh: 9_999,
    feeEnergyPerMwh: 0,
    date: "2026-10-07",
  };

  test("picks the band and the level", () => {
    expect(computeCommission(rules, context)).toBe(200);
    expect(computeCommission(rules, { ...context, annualKwh: 10_000 })).toBe(320);
    expect(computeCommission(rules, { ...context, level: "estándar" })).toBe(150);
    expect(computeCommission(rules, { ...context, level: "Cliente" })).toBeNull();
  });

  test("fee share is a percentage of the fee over the annual consumption", () => {
    // 50 % de 10 €/MWh × 4 MWh.
    expect(
      computeCommission(rules, { ...context, rateId: "r9", annualKwh: 4_000, feeEnergyPerMwh: 10 }),
    ).toBe(20);
  });

  test("fee share can be a percentage of the power fee", () => {
    const powerRules: CommissionRuleForEngine[] = [
      { rateId: null, accessTariff: null, level: null, channel: null, minAnnualKwh: null, maxAnnualKwh: null, ruleType: "fee_share", feeBase: "power", amount: 50, validFrom: "2026-01-01", validTo: null },
    ];
    // 50 % de 20 €/kW·año × (4,6 + 4,6) kW.
    expect(
      computeCommission(powerRules, { ...context, feePowerPerKwYear: 20, contractedKwTotal: 9.2 }),
    ).toBe(92);
  });

  test("respects validity dates", () => {
    expect(computeCommission(rules, { ...context, date: "2025-12-31" })).toBeNull();
  });
});

describe("staleness", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  test("classifies suppliers by days since the last version", () => {
    expect(freshness(null, now)).toEqual({ status: "never", days: null });
    expect(freshness("2026-09-30", now)).toEqual({ status: "fresh", days: 7 });
    expect(freshness("2025-04-10 09:00:00", now).status).toBe("stale");
  });

  test("median hours from arrival to decision", () => {
    expect(
      medianDecisionHours([
        { receivedAt: "2026-10-01 08:00:00", decidedAt: "2026-10-01 10:00:00" },
        { receivedAt: "2026-10-02 08:00:00", decidedAt: "2026-10-03 08:00:00" },
        { receivedAt: "2026-10-03 08:00:00", decidedAt: null },
      ]),
    ).toBe(13);
  });
});
