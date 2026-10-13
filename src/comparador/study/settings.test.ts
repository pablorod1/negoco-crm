import { describe, expect, test, vi } from "vitest";
import { cleanAncillary, getDefaultAncillary, setDefaultAncillary, SettingsUnavailableError } from "./settings";

describe("tenant SSAA default", () => {
  test("keeps valid €/MWh only; monthly wins over the average", () => {
    expect(cleanAncillary({ averagePerMwh: 12.345, monthlyPerMwh: null })).toEqual({ averagePerMwh: 12.35, monthlyPerMwh: null });
    expect(cleanAncillary({ averagePerMwh: 5, monthlyPerMwh: [10, -1, 300] })).toEqual({
      averagePerMwh: null,
      monthlyPerMwh: [10, null, null, null, null, null, null, null, null, null, null, null],
    });
    expect(cleanAncillary({ averagePerMwh: null, monthlyPerMwh: [] })).toBeNull();
  });

  test("works without the 029 table: no default, and saving says what is missing", async () => {
    const client = { execute: vi.fn(async () => Promise.reject(new Error("SQLITE_ERROR: no such table: comparador_settings"))) };
    await expect(getDefaultAncillary(client as never)).resolves.toBeNull();
    await expect(setDefaultAncillary(client as never, { averagePerMwh: 10, monthlyPerMwh: null }, "u1")).rejects.toBeInstanceOf(SettingsUnavailableError);
  });
});
