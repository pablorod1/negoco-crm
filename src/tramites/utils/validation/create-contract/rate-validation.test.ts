import { describe, expect, test } from "vitest";

import type { ImaginaRate } from "@/comercializadoras/types";
import { validateImaginaRate } from "./rate-validation";

const rates: ImaginaRate[] = [
  {
    id: "rate-1",
    name: "Plan Noche",
    external_rate_id: "11001",
    alias_externo: "Noche",
    codigo_atr: "2.0TD",
    descripcion: "Tarifa nocturna",
    synced_at: "2026-07-14T10:00:00.000Z",
  },
];

const baseInput = {
  isImaginaContract: true,
  rateId: "rate-1",
  integration: { enabled: true, configured: true },
  rates,
  loading: false,
  error: null,
};

describe("validateImaginaRate", () => {
  test("does not add rate validation to contracts from another supplier", () => {
    expect(
      validateImaginaRate({
        ...baseInput,
        isImaginaContract: false,
        rateId: null,
        integration: null,
        rates: [],
        loading: true,
        error: "Catálogo no disponible",
      }),
    ).toEqual({ succeeded: true });
  });

  test("blocks while the catalogue is loading", () => {
    expect(
      validateImaginaRate({
        ...baseInput,
        integration: null,
        loading: true,
      }),
    ).toEqual({
      succeeded: false,
      errorMessage: "Espera a que terminen de cargar las tarifas de Imagina.",
    });
  });

  test("blocks when the catalogue request fails", () => {
    expect(
      validateImaginaRate({
        ...baseInput,
        integration: null,
        error: "Servicio no disponible",
      }),
    ).toEqual({
      succeeded: false,
      errorMessage:
        "No se han podido cargar las tarifas de Imagina. Servicio no disponible",
    });
  });

  test("blocks while the integration state is unknown", () => {
    expect(
      validateImaginaRate({
        ...baseInput,
        integration: null,
      }),
    ).toEqual({
      succeeded: false,
      errorMessage:
        "No se ha podido comprobar la configuración de tarifas de Imagina.",
    });
  });

  test("keeps the previous flow when the tenant integration is not configured", () => {
    expect(
      validateImaginaRate({
        ...baseInput,
        rateId: null,
        integration: { enabled: true, configured: false },
        rates: [],
      }),
    ).toEqual({ succeeded: true });
  });

  test("blocks a configured integration with an empty catalogue", () => {
    expect(validateImaginaRate({ ...baseInput, rates: [] })).toEqual({
      succeeded: false,
      errorMessage: "No hay tarifas de Imagina disponibles.",
    });
  });

  test("requires a rate for a configured integration", () => {
    expect(validateImaginaRate({ ...baseInput, rateId: "  " })).toEqual({
      succeeded: false,
      errorMessage: "Selecciona una tarifa de Imagina.",
    });
  });

  test("rejects a rate that is no longer available", () => {
    expect(
      validateImaginaRate({ ...baseInput, rateId: "legacy-rate" }),
    ).toEqual({
      succeeded: false,
      errorMessage: "La tarifa seleccionada ya no está disponible.",
    });
  });

  test.each(["rate-1", "11001"])(
    "accepts an available rate by id or external_rate_id: %s",
    (rateId) => {
      expect(validateImaginaRate({ ...baseInput, rateId })).toEqual({
        succeeded: true,
      });
    },
  );
});
