import { describe, expect, test } from "vitest";
import { readDiscounts } from "./discounts";
import type { RateDiscount } from "./types";

const text = (value: string, conditional = true): RateDiscount => ({ kind: "other", value: null, months: null, conditional, text: value });

describe("readDiscounts", () => {
  test("Iberdrola: the base discount applies, the bracketed extras are conditional", () => {
    const { parts, informative } = readDiscounts([text("15% s/Te (+5% PyS Tier 1 +2% PyS Tier 2)")]);
    expect(parts).toEqual([
      expect.objectContaining({ key: "0.0", base: "energy", value: 15, conditional: false }),
      expect.objectContaining({ key: "0.1", base: "energy", value: 5, conditional: true }),
      expect.objectContaining({ key: "0.2", base: "energy", value: 2, conditional: true }),
    ]);
    expect(informative).toEqual([]);
  });

  test("energy and power, a condition with «si» and a second-year extra", () => {
    expect(readDiscounts([text("15% s/Te y Tp (+5% PyS Tier 1 +2% PyS Tier 2)")]).parts[0]).toMatchObject({ base: "energy_power", value: 15 });
    const { parts } = readDiscounts([text("20% s/Te (+5% si ACP) + 5% s/te 2año")]);
    expect(parts.map(({ value, conditional }) => [value, conditional])).toEqual([
      [20, false],
      [5, true],
    ]);
  });

  test("a fixed amount in euros", () => {
    expect(readDiscounts([text("100€ en Mi Iberdrola (+5% PyS Tier 1 +2% PyS Tier 2)")]).parts[0]).toMatchObject({
      base: "fixed",
      value: 100,
      conditional: false,
    });
  });

  test("what cannot be known is shown, not applied", () => {
    // Factor Energía: el precio de la tabla ya lleva el 27 %.
    expect(readDiscounts([text("27.0%", false)])).toMatchObject({ parts: [], informative: [{ text: "27.0%" }] });
    expect(readDiscounts([text("50% s/Te días vacacionales y fines de semana (+5% PyS Tier 1)")]).parts).toEqual([]);
    expect(readDiscounts([text("10% / 15% / 20% /25% / 30% Te (+5% PyS Tier 1 +2% PyS Tier 2)")]).informative).toHaveLength(1);
    expect(readDiscounts([text("s/ dto", false)])).toEqual({ parts: [], informative: [] });
  });

  test("structured discounts keep their kind, months and condition", () => {
    const { parts } = readDiscounts([
      { kind: "energy_percent", value: 10, months: 12, conditional: false, text: "Bienvenida" },
      { kind: "energy_percent", value: 3, months: 12, conditional: true, text: "Contratar servicio de mantenimiento" },
      { kind: "power_percent", value: 0.1, months: null, conditional: false, text: "10 % potencia" },
    ]);
    expect(parts.map(({ base, value, months, conditional }) => ({ base, value, months, conditional }))).toEqual([
      { base: "energy", value: 10, months: 12, conditional: false },
      { base: "energy", value: 3, months: 12, conditional: true },
      { base: "power", value: 10, months: null, conditional: false },
    ]);
  });
});

test("keeps the annex wording of each part", () => {
  expect(readDiscounts([text("20% s/Te (+10% PyS Tier 1*)")]).parts.map(({ text: part }) => part)).toEqual(["20% s/Te", "10% PyS Tier 1*"]);
});
