import { describe, expect, test } from "bun:test";
import {
  attachApoloSipsToRawPayload,
  createAbarcaApoloSipsSummary,
  parseAbarcaApoloSipsSummary,
} from "./abarca-apolo-sips.ts";

const consumptionRow = {
  cups: "ES0222120028021251AW",
  fechaInicioMesConsumo: "2025-01-01",
  fechaFinMesConsumo: "2025-01-31",
  codigoTarifaATR: "2.0TD",
  consumoEnergiaActivaEnWhP1: 0,
  consumoEnergiaActivaEnWhP2: 0,
  consumoEnergiaActivaEnWhP3: 0,
  consumoEnergiaActivaEnWhP4: 0,
  consumoEnergiaActivaEnWhP5: 0,
  consumoEnergiaActivaEnWhP6: 0,
  consumoEnergiaReactivaEnVArhP1: null,
  consumoEnergiaReactivaEnVArhP2: null,
  consumoEnergiaReactivaEnVArhP3: null,
  consumoEnergiaReactivaEnVArhP4: null,
  consumoEnergiaReactivaEnVArhP5: null,
  consumoEnergiaReactivaEnVArhP6: null,
  potenciaDemandadaEnWP1: 2200,
  potenciaDemandadaEnWP2: 3100,
  potenciaDemandadaEnWP3: null,
  potenciaDemandadaEnWP4: 0,
  potenciaDemandadaEnWP5: 0,
  potenciaDemandadaEnWP6: 0,
  codigoDHEquipoDeMedida: null,
  codigoTipoLectura: null,
};

describe("Abarca Apolo SIPS payload helpers", () => {
  test("creates max demand summary in kW", () => {
    const summary = createAbarcaApoloSipsSummary(
      " es0222120028021251aw ",
      [consumptionRow],
      "2026-01-01T00:00:00.000Z",
    );

    expect(summary).toEqual({
      cups: "ES0222120028021251AW",
      fetched_at: "2026-01-01T00:00:00.000Z",
      months: 1,
      has_data: true,
      max_demand_power_kw_by_period: {
        P1: 2.2,
        P2: 3.1,
        P3: 0,
        P4: 0,
        P5: 0,
        P6: 0,
      },
    });
  });

  test("attaches and parses Apolo summary from raw payload", () => {
    const summary = createAbarcaApoloSipsSummary(
      "ES0222120028021251AW",
      [consumptionRow],
      "2026-01-01T00:00:00.000Z",
    );
    const rawPayload = attachApoloSipsToRawPayload(
      { cups: "ES0222120028021251AW" },
      summary,
    );

    expect(parseAbarcaApoloSipsSummary(rawPayload)).toEqual(summary);
  });
});
