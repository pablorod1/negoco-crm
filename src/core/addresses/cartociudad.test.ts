import { expect, test } from "vitest";
import { normalizeCandidate } from "./cartociudad";

test("separates the street, extended portal and locality from real candidate labels", () => {
  expect(
    normalizeCandidate({
      id: "1",
      type: "portal",
      address: "CALLE MAYOR 1 C, Madrid",
      tip_via: "CALLE",
      portalNumber: 1,
      extension: "C",
      postalCode: "28013",
      muni: "Madrid",
      province: "Madrid",
    }),
  ).toMatchObject({
    address: "CALLE MAYOR 1 C",
    calle: "MAYOR",
    numero_finca: "1 C",
    tipo_via_cnmc: "Calle",
    city: "Madrid",
    province: "Madrid",
    postal_code: "28013",
  });
});
test("preserves numbers in street names and prefers population over municipality", () => {
  expect(
    normalizeCandidate({
      type: "portal",
      address: "CALLE 12 DE OCTUBRE 0, Madrid",
      tip_via: "CALLE",
      portalNumber: 0,
      poblacion: "Localidad",
      muni: "Madrid",
    }),
  ).toMatchObject({
    calle: "12 DE OCTUBRE",
    numero_finca: "0",
    city: "Localidad",
  });
});
test("does not invent a portal or postcode for a street candidate", () => {
  expect(
    normalizeCandidate({
      type: "callejero",
      address: "CALLE MAYOR, Madrid",
      tip_via: "CALLE",
      portalNumber: 0,
      muni: "Madrid",
    }),
  ).toMatchObject({ calle: "MAYOR", numero_finca: "", postal_code: "" });
});
