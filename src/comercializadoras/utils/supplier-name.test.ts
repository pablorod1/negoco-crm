import { describe, expect, test } from "vitest";

import { isImaginaSupplierName } from "./supplier-name";

describe("isImaginaSupplierName", () => {
  test.each([
    "Imagina Energía",
    "IMAGINA ENERGIA",
    "  imagina   energía  ",
    "Imagina%20Energ%C3%ADa",
  ])("recognizes the Imagina supplier variant %s", (name) => {
    expect(isImaginaSupplierName(name)).toBe(true);
  });

  test("handles malformed URI input without throwing", () => {
    expect(() => isImaginaSupplierName("%E0%A4%A")).not.toThrow();
    expect(isImaginaSupplierName("%E0%A4%A")).toBe(false);
  });

  test("rejects empty and unrelated supplier names", () => {
    expect(isImaginaSupplierName(undefined)).toBe(false);
    expect(isImaginaSupplierName("Otra Energía")).toBe(false);
  });
});
