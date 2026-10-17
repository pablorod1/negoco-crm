import { describe, expect, test } from "vitest";
import { ticks } from "./OfferScatter";

describe("ticks", () => {
  test("cover the largest value, so no point falls outside the chart", () => {
    // CMP de Jorge: ahorros de -1.528 € a 936 € y comisiones hasta 677 €.
    expect(ticks(-1528.46, 936.3)).toEqual([-2000, -1000, 0, 1000]);
    expect(ticks(0, 677.24)).toEqual([0, 200, 400, 600, 800]);
  });

  test("stop at the max when it is already round", () => {
    expect(ticks(0, 600)).toEqual([0, 200, 400, 600]);
    expect(ticks(0, 1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
