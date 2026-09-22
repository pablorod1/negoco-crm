import { describe, expect, it } from "vitest";
import { commissionSegmentFromTariff } from "./commission-segment";

describe("commissionSegmentFromTariff", () => {
  it.each([
    ["2.0TD", "Luz", "luz_20td"],
    ["3.0TD", "Luz", "luz_pymes"],
    ["6.1TD", "Luz", "luz_pymes"],
    ["RL.2", "Gas", "gas"],
    [null, "Gas", "gas"],
  ])("maps %s/%s to %s", (tariff, service, expected) => {
    expect(commissionSegmentFromTariff(tariff, service)).toBe(expected);
  });

  it.each(["1TD", "1.0TD", "2.1TD", "unknown"])("does not guess %s", (tariff) => {
    expect(commissionSegmentFromTariff(tariff, "Luz")).toBeNull();
  });
});
