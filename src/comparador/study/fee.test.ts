import { describe, expect, test } from "vitest";
import { toProposedRates } from "@/comparador/rates/normalize";
import type { ExtractedRate } from "@/comparador/rates/schema";
import { feeFor } from "./ranking";
import { cleanFeePolicy, feePolicyFor, type FeePolicies } from "./settings";

const base = { feeEnergyMinPerMwh: 0, feeEnergyMaxPerMwh: null };

describe("fee of base prices", () => {
  test("the agency's usual fee applies unless the salesperson writes another", () => {
    expect(feeFor(base, null, { habitual: 30, max: null })).toEqual({ fee: 30, range: { min: 0, max: null } });
    expect(feeFor(base, 18, { habitual: 30, max: null }).fee).toBe(18);
    // Sin habitual ni fee escrito: el mínimo del anexo.
    expect(feeFor({ feeEnergyMinPerMwh: 1, feeEnergyMaxPerMwh: null }, null).fee).toBe(1);
  });

  test("never below the annex minimum, never above the maximum; without a maximum there is no cap", () => {
    expect(feeFor({ feeEnergyMinPerMwh: 1, feeEnergyMaxPerMwh: null }, 0, { habitual: null, max: null }).fee).toBe(1);
    expect(feeFor(base, 80, { habitual: 30, max: 40 })).toEqual({ fee: 40, range: { min: 0, max: 40 } });
    expect(feeFor(base, 80, { habitual: 30, max: null }).fee).toBe(80);
    // El máximo del anexo manda sobre el de la agencia.
    expect(feeFor({ feeEnergyMinPerMwh: 0, feeEnergyMaxPerMwh: 20 }, null, { habitual: 30, max: 40 }).fee).toBe(20);
  });

  test("a product that is not a base price takes no fee", () => {
    expect(feeFor({ feeEnergyMinPerMwh: null, feeEnergyMaxPerMwh: null }, 30, { habitual: 30, max: null })).toEqual({ fee: 0, range: null });
  });

  test("each supplier's policy, or the general usual fee", () => {
    const policies: FeePolicies = { general: { habitual: 25 }, bySupplier: { "COM-1": { habitual: null, max: 40 }, "COM-2": { habitual: 30, max: null } } };
    expect(feePolicyFor(policies, "COM-1")).toEqual({ habitual: 25, max: 40 });
    expect(feePolicyFor(policies, "COM-2")).toEqual({ habitual: 30, max: null });
    expect(feePolicyFor(policies, "COM-3")).toEqual({ habitual: 25, max: null });
    expect(feePolicyFor(undefined, "COM-3")).toEqual({ habitual: null, max: null });
    expect(cleanFeePolicy({ habitual: 50, max: 40 })).toEqual({ habitual: 40, max: 40 });
    expect(cleanFeePolicy({ habitual: -1, max: "x" })).toEqual({ habitual: null, max: null });
  });

  test("a base product read from an annex takes the agency fee even if the annex gives no minimum", () => {
    const rate = (overrides: Partial<ExtractedRate>): ExtractedRate => ({
      productName: "Tarifa Fija Base + Fee", accessTariff: "2.0TD", pricing: "fixed", level: null, territory: null, channel: null,
      segment: null, minKw: null, maxKw: null, minKwh: null, maxKwh: null, startFrom: null, startTo: null, months: null,
      powerMode: "not_stated", powerUnit: null, powerP1: null, powerP2: null, powerMargin: null, energyUnit: "eur_kwh",
      energyP1: 0.25, energyP2: 0.15, energyP3: 0.12, singlePrice: false, ancillaryIncluded: true, gasTollsIncluded: null,
      feeMinMwh: null, feeMaxMwh: null, feeOnPower: false, discounts: [], ...overrides,
    });
    const [visalia, plain, withMinimum] = toProposedRates({
      rates: [rate({}), rate({ productName: "Visalia Low", powerMode: "fixed", powerUnit: "eur_kw_year", powerP1: 33, powerP2: 33 }), rate({ feeMinMwh: 1 })],
    });
    expect(visalia).toMatchObject({ feeEnergyMinPerMwh: 0, feeEnergyMaxPerMwh: null, powerMode: "regulated" });
    expect(plain.feeEnergyMinPerMwh).toBeNull();
    expect(withMinimum.feeEnergyMinPerMwh).toBe(1);
  });
});
