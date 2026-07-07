import type { ApoloSipsElectricityConsumptionRow } from "./types";

export type ApoloSipsPeriod = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export type ApoloSipsPeriodValues = Record<ApoloSipsPeriod, number>;

export interface ApoloSipsElectricityConsumptionSummary {
  rows: ApoloSipsElectricityConsumptionRow[];
  activeEnergyKwhByPeriod: ApoloSipsPeriodValues;
  maxDemandPowerKwByPeriod: ApoloSipsPeriodValues;
  totalActiveEnergyKwh: number;
}

const PERIODS: ApoloSipsPeriod[] = ["P1", "P2", "P3", "P4", "P5", "P6"];

const ACTIVE_ENERGY_FIELDS = {
  P1: "consumoEnergiaActivaEnWhP1",
  P2: "consumoEnergiaActivaEnWhP2",
  P3: "consumoEnergiaActivaEnWhP3",
  P4: "consumoEnergiaActivaEnWhP4",
  P5: "consumoEnergiaActivaEnWhP5",
  P6: "consumoEnergiaActivaEnWhP6",
} as const satisfies Record<
  ApoloSipsPeriod,
  keyof ApoloSipsElectricityConsumptionRow
>;

const DEMAND_POWER_FIELDS = {
  P1: "potenciaDemandadaEnWP1",
  P2: "potenciaDemandadaEnWP2",
  P3: "potenciaDemandadaEnWP3",
  P4: "potenciaDemandadaEnWP4",
  P5: "potenciaDemandadaEnWP5",
  P6: "potenciaDemandadaEnWP6",
} as const satisfies Record<
  ApoloSipsPeriod,
  keyof ApoloSipsElectricityConsumptionRow
>;

const EMPTY_PERIOD_VALUES: ApoloSipsPeriodValues = {
  P1: 0,
  P2: 0,
  P3: 0,
  P4: 0,
  P5: 0,
  P6: 0,
};

export function selectLatestElectricityConsumptionRows(
  rows: ApoloSipsElectricityConsumptionRow[],
  limit = 12,
): ApoloSipsElectricityConsumptionRow[] {
  return [...rows]
    .sort(
      (left, right) =>
        getConsumptionTimestamp(right) - getConsumptionTimestamp(left),
    )
    .slice(0, limit);
}

export function summarizeElectricityConsumption(
  rows: ApoloSipsElectricityConsumptionRow[],
  months = 12,
): ApoloSipsElectricityConsumptionSummary {
  const latestRows = selectLatestElectricityConsumptionRows(rows, months);
  const activeEnergyWhByPeriod = { ...EMPTY_PERIOD_VALUES };
  const maxDemandPowerWByPeriod = { ...EMPTY_PERIOD_VALUES };

  for (const row of latestRows) {
    for (const period of PERIODS) {
      activeEnergyWhByPeriod[period] += getNumber(
        row[ACTIVE_ENERGY_FIELDS[period]],
      );
      maxDemandPowerWByPeriod[period] = Math.max(
        maxDemandPowerWByPeriod[period],
        getNumber(row[DEMAND_POWER_FIELDS[period]]),
      );
    }
  }

  const activeEnergyKwhByPeriod = mapPeriodValues(
    activeEnergyWhByPeriod,
    whToKwh,
  );
  const maxDemandPowerKwByPeriod = mapPeriodValues(
    maxDemandPowerWByPeriod,
    wToKw,
  );
  const totalActiveEnergyKwh = PERIODS.reduce(
    (total, period) => total + activeEnergyKwhByPeriod[period],
    0,
  );

  return {
    rows: latestRows,
    activeEnergyKwhByPeriod,
    maxDemandPowerKwByPeriod,
    totalActiveEnergyKwh,
  };
}

function getConsumptionTimestamp(row: ApoloSipsElectricityConsumptionRow): number {
  const rawDate = row.fechaFinMesConsumo || row.fechaInicioMesConsumo;
  if (!rawDate) return Number.NEGATIVE_INFINITY;

  const timestamp = Date.parse(rawDate);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function getNumber(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapPeriodValues(
  values: ApoloSipsPeriodValues,
  mapper: (value: number) => number,
): ApoloSipsPeriodValues {
  return {
    P1: mapper(values.P1),
    P2: mapper(values.P2),
    P3: mapper(values.P3),
    P4: mapper(values.P4),
    P5: mapper(values.P5),
    P6: mapper(values.P6),
  };
}

function whToKwh(value: number): number {
  return value / 1000;
}

function wToKw(value: number): number {
  return value / 1000;
}
