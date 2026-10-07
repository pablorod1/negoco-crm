import { describe, expect, test } from "vitest";
import { applyFee, computeAnnualCost, computeCost } from "./cost";
import { roundEuros } from "./money";
import {
  getRegulatedParams,
  RegulatedParamsUnavailableError,
} from "./regulated";

// Importes y precios de facturas reales de Beenergy (sin datos personales).
describe("computeCost reproduces real invoices to the cent", () => {
  test("Naturgy, 32 días, 2.0TD con precio único de energía", () => {
    const cost = computeCost({
      days: 32,
      contractedKw: { P1: 3.45, P2: 3.45 },
      energyKwh: { P1: 367, P2: 0, P3: 0 },
      prices: {
        power: { P1: 0.12303, P2: 0.037337 },
        energy: { P1: 0.1099, P2: 0.1099, P3: 0.1099 },
      },
      regulated: getRegulatedParams("2026-09-13"),
      meterRental: { perDay: 0.02663 },
    });

    expect(cost.power).toEqual({ P1: 13.58, P2: 4.12, total: 17.7 });
    expect(cost.energy.total).toBe(40.33);
    expect(cost.socialBonus).toBe(0.79);
    expect(cost.electricitySubtotal).toBe(58.82);
    expect(cost.electricityTax).toBe(3.01);
    expect(cost.meterRental).toBe(0.85);
    expect(cost.taxableBase).toBe(62.68);
    expect(cost.vat).toBe(13.16);
    expect(cost.total).toBe(75.84);
  });

  test("Iberdrola, 28 días, con dos descuentos sobre el consumo y un pack", () => {
    const cost = computeCost({
      days: 28,
      contractedKw: { P1: 3.4, P2: 3.4 },
      energyKwh: { P1: 130, P2: 0, P3: 0 },
      prices: {
        power: { P1: 0.12463, P2: 0.062986 },
        energy: { P1: 0.156125, P2: 0.156125, P3: 0.156125 },
      },
      regulated: getRegulatedParams("2026-08-31"),
      energyDiscountRates: [0.05, 0.2],
      meterRental: { perDay: 0.02663, days: 32 },
      // Pack Iberdrola Hogar 8,30 € con un 50 % de descuento.
      servicesAmount: 4.15,
    });

    expect(cost.power).toEqual({ P1: 11.86, P2: 6, total: 17.86 });
    expect(cost.energy.total).toBe(20.3);
    expect(cost.energyDiscounts).toEqual([-1.02, -4.06]);
    expect(cost.socialBonus).toBe(0.69);
    expect(cost.electricitySubtotal).toBe(33.77);
    expect(cost.electricityTax).toBe(1.73);
    expect(cost.taxableBase).toBe(40.5);
    expect(cost.vat).toBe(8.51);
    expect(cost.total).toBe(49.01);
  });
});

describe("computeAnnualCost", () => {
  const profile = {
    contractedKw: { P1: 2.2, P2: 2.2 },
    annualKwh: { P1: 841, P2: 872, P3: 1052 },
    meterRentalPerDay: 0.026301,
  };
  const snap = {
    power: { P1: 0.0895, P2: 0.0895 },
    energy: { P1: 0.1245, P2: 0.1245, P3: 0.1245 },
  };

  test("matches Abarca's lines and adds the social bonus to the taxable base", () => {
    const cost = computeAnnualCost(
      profile,
      snap,
      getRegulatedParams("2026-10-06"),
    );

    // Mismas líneas que el PDF de Abarca para APOLO SNAP.
    expect(cost.power.total).toBe(143.74);
    expect(cost.energy).toEqual({
      P1: 104.7,
      P2: 108.56,
      P3: 130.97,
      total: 344.23,
    });
    expect(cost.socialBonus).toBe(9.01);
    expect(cost.meterRental).toBe(9.6);
    // Abarca deja fuera el bono social de la base imponible; nosotros no.
    expect(cost.taxableBase).toBe(
      roundEuros(cost.electricitySubtotal + cost.electricityTax + 9.6),
    );
    expect(cost.total).toBe(roundEuros(cost.taxableBase * 1.21));
  });

  test("prorates yearly services into the period", () => {
    const withServices = computeAnnualCost(
      profile,
      { ...snap, servicesPerYear: 36 },
      getRegulatedParams("2026-10-06"),
    );
    expect(withServices.services).toBe(36);
  });
});

describe("applyFee", () => {
  test("adds €/MWh to energy and €/kW·año to power", () => {
    const prices = applyFee(
      {
        power: { P1: 0.1, P2: 0.05 },
        energy: { P1: 0.12, P2: 0.12, P3: 0.12 },
      },
      { energyPerMwh: 10, powerPerKwYear: 3.65 },
    );

    expect(prices.energy.P1).toBeCloseTo(0.13, 10);
    expect(prices.power.P1).toBeCloseTo(0.11, 10);
    expect(prices.power.P2).toBeCloseTo(0.06, 10);
  });
});

describe("getRegulatedParams", () => {
  test("switches the social bonus on 1 July 2026", () => {
    expect(getRegulatedParams("2026-06-30").socialBonusPerDay).toBe(0.019121);
    expect(getRegulatedParams("2026-07-01").socialBonusPerDay).toBe(0.024688);
  });

  test("refuses dates without verified values", () => {
    expect(() => getRegulatedParams("2025-12-31")).toThrow(
      RegulatedParamsUnavailableError,
    );
    expect(() => getRegulatedParams("06/10/2026")).toThrow(RangeError);
  });
});

describe("roundEuros", () => {
  test("rounds half away from zero despite floating point noise", () => {
    expect(roundEuros(1.015)).toBe(1.02);
    expect(roundEuros(8.505)).toBe(8.51);
    expect(roundEuros(-1.015)).toBe(-1.02);
    expect(roundEuros(2.0296)).toBe(2.03);
  });
});
