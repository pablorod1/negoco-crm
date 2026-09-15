import { describe, expect, test } from "vitest";

import { isProtectedSupplierFolder } from "./protected-folders";

const active = ["Endesa", "Total Energies"];

describe("isProtectedSupplierFolder", () => {
  test("protects the root folder of an active supplier, however it is spelled", () => {
    expect(isProtectedSupplierFolder("Endesa", active)).toBe(true);
    expect(isProtectedSupplierFolder(" ENDESA ", active)).toBe(true);
    expect(isProtectedSupplierFolder("TOTALENERGIES", active)).toBe(true);
  });

  test("leaves subfolders, other folders and the root alone", () => {
    expect(isProtectedSupplierFolder("Endesa/Contratos", active)).toBe(false);
    expect(isProtectedSupplierFolder("Manuales", active)).toBe(false);
    expect(isProtectedSupplierFolder("/", active)).toBe(false);
  });

  test("stops protecting a folder once its supplier is no longer active", () => {
    expect(isProtectedSupplierFolder("Endesa", ["Iberdrola"])).toBe(false);
  });
});
