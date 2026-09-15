import { describe, expect, test } from "vitest";
import { getAbarcaSupplierName, resolveAbarcaSupplier } from "./abarca-supplier";

const suppliers = [
  { id: "tenant-nordy", name: "Nordy" }, { id: "air", name: "Aire Limpio" },
  { id: "gana", name: "Gana Energía" }, { id: "imagina", name: "Imagina Energía" },
];
describe("Abarca supplier formats", () => {
  test.each([
    ["NORDY RESIDENCIAL - Tarifa Estabilidad 3P", "tenant-nordy"],
    ["NORDY EMPRESA", "tenant-nordy"], ["NORDY", "tenant-nordy"],
    ["AIRELIMPIO - Tarifa Feria Precio Fijo 2026", "air"], ["AIRELIMPIO", "air"],
    ["GANA - 24H LUZ", "gana"], ["IMAGINA ENERGIA", "imagina"],
    ["  imagina   energía  ", "imagina"],
  ])("maps %s to the tenant catalogue", (name, id) => {
    expect(resolveAbarcaSupplier(name, suppliers)).toEqual({ supplier: suppliers.find(s => s.id === id), ambiguous: false });
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
});
