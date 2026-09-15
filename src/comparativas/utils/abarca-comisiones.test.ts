import { describe, expect, test } from "vitest";
import { parseAbarcaComisiones } from "./abarca-comisiones";

describe("parseAbarcaComisiones", () => {
  test("reads both commissions from the stored payload", () => {
    const rawPayload = JSON.stringify({
      ide: 1,
      comision_oferta: 120.5,
      comision_base: 30,
    });

    expect(parseAbarcaComisiones(rawPayload)).toEqual({
      base: 30,
      oferta: 120.5,
    });
  });

  test("keeps a commission that arrives alone", () => {
    const rawPayload = JSON.stringify({ comision_oferta: 80 });

    expect(parseAbarcaComisiones(rawPayload)).toEqual({
      base: null,
      oferta: 80,
    });
  });

  test("accepts zero as a real commission", () => {
    const rawPayload = JSON.stringify({
      comision_oferta: 0,
      comision_base: 0,
    });

    expect(parseAbarcaComisiones(rawPayload)).toEqual({
      base: 0,
      oferta: 0,
    });
  });

  test.each([
    ["a payload without commissions", JSON.stringify({ ide: 1 })],
    ["malformed json", "{not json"],
    ["null commissions", JSON.stringify({ comision_oferta: null })],
    ["a string instead of a number", JSON.stringify({ comision_base: "30" })],
  ])("returns nothing for %s", (_name, rawPayload) => {
    expect(parseAbarcaComisiones(rawPayload)).toBeNull();
  });
});
