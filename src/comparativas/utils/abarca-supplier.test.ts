import { describe, expect, test } from "vitest";
import { getAbarcaSupplierName, resolveAbarcaSupplier } from "./abarca-supplier";

const suppliers = [
  { id: "COM-007", name: "Gana Energía" },
  { id: "COM-013", name: "Repsol" },
  { id: "COM-021", name: "Plenitude" },
  { id: "COM-022", name: "Quimera" },
  { id: "COM-023", name: "Nordy" },
  { id: "COM-024", name: "ADX" },
  { id: "COM-025", name: "Visalia" },
  { id: "COM-026", name: "Aire Limpio" },
  { id: "COM-027", name: "Bualá" },
  { id: "COM-029", name: "HOLALUZ" },
  { id: "imagina", name: "Imagina Energía" },
];
describe("Abarca supplier formats", () => {
  test("persisted tenant mappings override aliases and respect segments", () => {
    const mappings = [
      { abarca_name: "GANA", segment: "gas", comercializadora_id: "COM-013" },
      { abarca_name: "GANA", segment: "luz_20td", comercializadora_id: "COM-007" },
    ];
    expect(resolveAbarcaSupplier("GANA - Tarifa", suppliers, mappings, "gas").supplier?.id).toBe("COM-013");
    expect(resolveAbarcaSupplier("GANA", suppliers, mappings).ambiguous).toBe(true);
    expect(resolveAbarcaSupplier("GANA", suppliers, [
      { abarca_name: "GANA", segment: "gas", comercializadora_id: null },
    ], "gas").supplier).toBeNull();
  });
  test.each([
    ["NORDY RESIDENCIAL - Tarifa Estabilidad 3P", "COM-023"],
    ["NORDY EMPRESA", "COM-023"], ["NORDY", "COM-023"],
    ["AIRELIMPIO - Tarifa Feria Precio Fijo 2026", "COM-026"], ["AIRELIMPIO", "COM-026"],
    ["GANA - 24H LUZ", "COM-007"], ["IMAGINA ENERGIA", "imagina"],
    ["  imagina   energía  ", "imagina"],
  ])("maps %s to the tenant catalogue", (name, id) => {
    expect(resolveAbarcaSupplier(name, suppliers)).toEqual({ supplier: suppliers.find(s => s.id === id), ambiguous: false });
  });
  test.each([
    ["REPSOL", "COM-013"], ["REPSOL - Tarifa Ahorro Plus", "COM-013"],
    ["PLENITUDE", "COM-021"], ["PLENITUDE - Tarifa Fija", "COM-021"],
    ["QUIMERA", "COM-022"], ["QUIMERA - Tarifa Indexada", "COM-022"],
    ["ADX", "COM-024"], ["ADX - Tarifa 3.0TD", "COM-024"],
    ["VISALIA", "COM-025"], ["VISALIA - Tarifa Precio Fijo", "COM-025"],
    ["BUALA", "COM-027"], ["BUALÁ - Tarifa Estable", "COM-027"],
    ["HOLALUZ", "COM-029"], ["HOLALUZ - Tarifa Clásica", "COM-029"],
    ["HOLA LUZ", "COM-029"], ["HOLA LUZ - Tarifa Clásica", "COM-029"],
  ])("maps Eficience supplier %s to %s", (name, id) => {
    expect(resolveAbarcaSupplier(name, suppliers)).toEqual({
      supplier: suppliers.find((supplier) => supplier.id === id),
      ambiguous: false,
    });
  });
  test.each([undefined, null, "", "  "])("absent dedicated name %s uses empresa", (comercializadora) => {
    expect(getAbarcaSupplierName({ comercializadora, empresa: "NORDY EMPRESA" })).toBe("NORDY EMPRESA");
  });
  test("dedicated field has priority and also works without empresa", () => {
    expect(getAbarcaSupplierName({ comercializadora: "NORDY", empresa: "AIRELIMPIO" })).toBe("NORDY");
    expect(getAbarcaSupplierName({ comercializadora: "NORDY" })).toBe("NORDY");
    expect(getAbarcaSupplierName({})).toBeNull();
  });
  test("unknown names never match arbitrary substrings", () => {
    expect(resolveAbarcaSupplier("NORDY EXTRA", suppliers).supplier).toBeNull();
  });
  test("duplicate normalized catalogue entries remain ambiguous", () => {
    expect(resolveAbarcaSupplier("IMAGINA ENERGIA", [...suppliers, { id: "duplicate", name: "Imagina energia" }])).toEqual({ supplier: null, ambiguous: true });
  });
  test("duplicate compact catalogue entries remain ambiguous", () => {
    expect(resolveAbarcaSupplier("HOLA LUZ", [
      { id: "joined", name: "HOLALUZ" },
      { id: "hyphenated", name: "HOLA-LUZ" },
    ])).toEqual({ supplier: null, ambiguous: true });
  });
});
