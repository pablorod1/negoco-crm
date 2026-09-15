import { describe, expect, test } from "bun:test";
import {
  selectLatestElectricityConsumptionRows,
  summarizeElectricityConsumption,
} from "./summary.ts";

const row = ({
  date,
  p1 = 0,
  p2 = 0,
  p3 = 0,
  p4 = 0,
  p5 = 0,
  p6 = 0,
  demandP1 = 0,
  demandP2 = 0,
  demandP3 = 0,
  demandP4 = 0,
  demandP5 = 0,
  demandP6 = 0,
}) => ({
  cups: "ES0222120028021251AW",
  fechaInicioMesConsumo: date,
  fechaFinMesConsumo: date,
  codigoTarifaATR: "2.0TD",
  consumoEnergiaActivaEnWhP1: p1,
  consumoEnergiaActivaEnWhP2: p2,
  consumoEnergiaActivaEnWhP3: p3,
  consumoEnergiaActivaEnWhP4: p4,
  consumoEnergiaActivaEnWhP5: p5,
  consumoEnergiaActivaEnWhP6: p6,
  consumoEnergiaReactivaEnVArhP1: null,
  consumoEnergiaReactivaEnVArhP2: null,
  consumoEnergiaReactivaEnVArhP3: null,
  consumoEnergiaReactivaEnVArhP4: null,
  consumoEnergiaReactivaEnVArhP5: null,
  consumoEnergiaReactivaEnVArhP6: null,
  potenciaDemandadaEnWP1: demandP1,
  potenciaDemandadaEnWP2: demandP2,
  potenciaDemandadaEnWP3: demandP3,
  potenciaDemandadaEnWP4: demandP4,
  potenciaDemandadaEnWP5: demandP5,
  potenciaDemandadaEnWP6: demandP6,
  codigoDHEquipoDeMedida: null,
  codigoTipoLectura: null,
});

describe("SIPS electricity consumption summary", () => {
  test("sums active energy P1-P6 and converts Wh to kWh", () => {
    const summary = summarizeElectricityConsumption([
      row({
        date: "2025-01-31",
        p1: 1000,
        p2: 2000,
        p3: 3000,
        p4: 4000,
        p5: 5000,
        p6: 6000,
      }),
    ]);

    expect(summary.activeEnergyKwhByPeriod).toEqual({
      P1: 1,
      P2: 2,
      P3: 3,
      P4: 4,
      P5: 5,
      P6: 6,
    });
    expect(summary.totalActiveEnergyKwh).toBe(21);
  });

  test("selects only the 12 most recent consumption rows", () => {
    const rows = Array.from({ length: 13 }, (_, index) => {
      const date = new Date(Date.UTC(2024, index, 28));
      return row({
        date: date.toISOString().slice(0, 10),
        p1: 1000,
      });
    });

    const selectedRows = selectLatestElectricityConsumptionRows(rows);
    const summary = summarizeElectricityConsumption(rows);

    expect(selectedRows).toHaveLength(12);
    expect(
      selectedRows.some((item) => item.fechaFinMesConsumo === "2024-01-28"),
    ).toBe(false);
    expect(summary.totalActiveEnergyKwh).toBe(12);
  });

  test("treats null active energy values as zero", () => {
    const summary = summarizeElectricityConsumption([
      {
        ...row({ date: "2025-01-31", p1: 1000 }),
        consumoEnergiaActivaEnWhP2: null,
      },
    ]);

    expect(summary.activeEnergyKwhByPeriod.P1).toBe(1);
    expect(summary.activeEnergyKwhByPeriod.P2).toBe(0);
    expect(summary.totalActiveEnergyKwh).toBe(1);
  });

  test("calculates max demanded power by period and converts W to kW", () => {
    const summary = summarizeElectricityConsumption([
      row({ date: "2025-01-31", demandP1: 1200, demandP2: 3000 }),
      row({ date: "2025-02-28", demandP1: 1800, demandP2: 2500 }),
    ]);

    expect(summary.maxDemandPowerKwByPeriod).toEqual({
      P1: 1.8,
      P2: 3,
      P3: 0,
      P4: 0,
      P5: 0,
      P6: 0,
    });
  });
});
