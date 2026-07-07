import { describe, expect, test } from "vitest";
import { isProviderAllowed, normalizeProviderList } from "./server";
import { delayToMinutes, minutesToDelayInput } from "./utils";

describe("CRM settings helpers", () => {
  test("normalizes and deduplicates providers", () => {
    expect(
      normalizeProviderList(["  Iberdrola  ", "iberdrola", "", "Endesa"]),
    ).toEqual([
      { name: "Iberdrola", normalized_name: "iberdrola" },
      { name: "Endesa", normalized_name: "endesa" },
    ]);
  });

  test("converts automation delay units", () => {
    expect(delayToMinutes(2, "hours")).toBe(120);
    expect(delayToMinutes(3, "days")).toBe(4320);
    expect(minutesToDelayInput(1440)).toEqual({
      delay_value: 1,
      delay_unit: "days",
    });
  });

  test("allows legacy provider values already stored on the tramite", () => {
    const providers = [
      {
        id: "provider-1",
        name: "Endesa",
        normalized_name: "endesa",
        sort_order: 0,
        created_at: null,
        updated_at: null,
      },
    ];

    expect(isProviderAllowed(providers, "Endesa")).toBe(true);
    expect(isProviderAllowed(providers, "Legacy", "Legacy")).toBe(true);
    expect(isProviderAllowed(providers, "Other")).toBe(false);
  });
});
