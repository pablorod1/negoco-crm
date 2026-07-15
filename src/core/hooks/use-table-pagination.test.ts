import { describe, expect, test } from "vitest";
import { normalizeTablePageSize } from "./use-table-pagination";

describe("normalizeTablePageSize", () => {
  test("uses 50 rows when no valid preference exists", () => {
    expect(normalizeTablePageSize(undefined)).toBe(50);
    expect(normalizeTablePageSize("invalid")).toBe(50);
  });

  test("caps legacy large and unlimited preferences at 100", () => {
    expect(normalizeTablePageSize(200)).toBe(100);
    expect(normalizeTablePageSize("400")).toBe(100);
    expect(normalizeTablePageSize("Sin Límite")).toBe(100);
  });

  test("keeps supported bounded page sizes", () => {
    expect(normalizeTablePageSize(15)).toBe(15);
    expect(normalizeTablePageSize("50")).toBe(50);
    expect(normalizeTablePageSize(100)).toBe(100);
  });
});
