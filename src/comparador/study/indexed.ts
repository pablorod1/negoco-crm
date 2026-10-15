import type { EnergyByPeriod } from "@/comparador/engine/types";
import { daysBetween } from "@/comparador/market/omie";
import type { StudySupply, SupplyReading } from "./supply";

const PERIODS = ["P1", "P2", "P3"] as const;

/**
 * Precio de energía de un año con una tarifa indexada. Su comercializadora le
 * cobra el mercado más un margen (peajes, cargos, SSAA, su fee…): el margen
 * sale de su factura frente al OMIE de esos mismos días, y se suma al OMIE de
 * cada lectura del SIPS. Devuelve el precio medio de cada periodo, ponderado
 * por lo que consumió en cada lectura; null sin lecturas o sin mercado.
 */
export function indexedEnergyPrices(invoicePrices: EnergyByPeriod, supply: StudySupply): EnergyByPeriod | null {
  const { market, readings } = supply;
  if (!market || !readings?.length || market.readings.length !== readings.length) return null;
  const result = { P1: 0, P2: 0, P3: 0 };
  for (const period of PERIODS) {
    const margin = invoicePrices[period] - market.invoice[period] / 1000;
    const kwh = readings.reduce((sum, reading) => sum + reading.kwh[period], 0);
    const weighted =
      kwh > 0
        ? readings.reduce((sum, reading, index) => sum + reading.kwh[period] * market.readings[index][period], 0) / kwh
        : market.readings.reduce((sum, prices) => sum + prices[period], 0) / market.readings.length;
    result[period] = margin + weighted / 1000;
  }
  return result;
}

/**
 * Lo que su factura cobra de media por encima del mercado, en €/kWh,
 * ponderado por su consumo en la factura: peajes, cargos y el margen de su
 * comercializadora. Es lo que Beenergy mira para saber qué fee le aplican.
 */
export function marginOverMarket(
  invoicePrices: EnergyByPeriod,
  supply: StudySupply,
  invoiceKwh: Partial<Record<(typeof PERIODS)[number], number | null>>,
): number | null {
  const market = supply.market;
  if (!market) return null;
  const total = PERIODS.reduce((sum, period) => sum + (invoiceKwh[period] ?? 0), 0);
  if (total <= 0) return null;
  return PERIODS.reduce(
    (sum, period) => sum + (invoiceKwh[period] ?? 0) * (invoicePrices[period] - market.invoice[period] / 1000),
    0,
  ) / total;
}

export type HistoryPrices =
  | {
      /** Precio medio de cada periodo en el año del SIPS, €/kWh. */
      energy: EnergyByPeriod;
      /** Meses del histórico usados (YYYY-MM), del primero al último. */
      from: string;
      to: string;
    }
  | { missing: string[] };

/**
 * Precio de energía de un año con una tarifa indexada de la que se tiene el
 * histórico: cada lectura del SIPS se cobra al precio de sus meses (repartida
 * por días si cruza de un mes a otro). Devuelve la media de cada periodo,
 * ponderada por lo que consumió en cada lectura, o los meses que faltan en el
 * histórico: sin ellos no se oferta, porque no hay precio real que poner.
 */
export function historyEnergyPrices(
  history: ReadonlyMap<string, EnergyByPeriod>,
  readings: readonly SupplyReading[],
): HistoryPrices | null {
  if (readings.length === 0) return null;
  const shares = readings.map((reading) => {
    const days = daysBetween(reading.from, reading.to);
    const byMonth = new Map<string, number>();
    for (const day of days) byMonth.set(day.slice(0, 7), (byMonth.get(day.slice(0, 7)) ?? 0) + 1 / days.length);
    return byMonth;
  });
  const months = [...new Set(shares.flatMap((byMonth) => [...byMonth.keys()]))].sort();
  // El histórico llega con un mes de retraso: el mes que aún no está se
  // cobra como el mismo mes del año anterior (lo que hace Beenergy: en
  // octubre, el indexado de octubre del año pasado). Un mes anterior al
  // principio del histórico, como el mismo mes del año siguiente.
  const used = new Map<string, string>();
  for (const month of months) {
    const candidate = [month, shiftYear(month, -1), shiftYear(month, 1)].find((option) => history.has(option));
    if (candidate) used.set(month, candidate);
  }
  const missing = months.filter((month) => !used.has(month));
  if (missing.length > 0) return { missing };
  const priceOf = (month: string) => history.get(used.get(month)!)!;

  const energy = { P1: 0, P2: 0, P3: 0 };
  for (const period of PERIODS) {
    const kwh = readings.reduce((sum, reading) => sum + reading.kwh[period], 0);
    if (kwh <= 0) {
      energy[period] = months.reduce((sum, month) => sum + priceOf(month)[period], 0) / months.length;
      continue;
    }
    const cost = readings.reduce(
      (sum, reading, index) =>
        sum + reading.kwh[period] * [...shares[index]].reduce((part, [month, share]) => part + share * priceOf(month)[period], 0),
      0,
    );
    energy[period] = cost / kwh;
  }
  const sources = [...used.values()].sort();
  return { energy, from: sources[0], to: sources.at(-1)! };
}

/** «2026-10» y -1 → «2025-10». */
function shiftYear(month: string, years: number): string {
  return `${Number(month.slice(0, 4)) + years}${month.slice(4)}`;
}
