import type { EnergyByPeriod } from "@/comparador/engine/types";

/**
 * Precio del mercado diario (OMIE) por periodo de la 2.0TD. Sirve para
 * comparar una factura indexada: lo que pagó en su factura frente al mercado
 * de esos días dice el margen que le aplica su comercializadora, y el mercado
 * de los 12 meses del SIPS dice lo que habría pagado en un año.
 */

/** Precios de un día en €/MWh, uno por cuarto de hora (o por hora antes de octubre de 2025). */
export type OmieDay = number[];
export type OmieDayFetcher = (date: string) => Promise<OmieDay | null>;

const OMIE_URL = "https://www.omie.es/es/file-download?parents=marginalpdbc&filename=marginalpdbc_";

/**
 * Lee el fichero diario de OMIE: «año;mes;día;periodo;precio PT;precio ES;».
 * Se usa el precio de España. Si no es un fichero de precios (día futuro, error), null.
 */
export function parseOmieDay(text: string): OmieDay | null {
  if (!text.startsWith("MARGINALPDBC")) return null;
  const prices: number[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const fields = line.split(";");
    if (fields.length < 6) continue;
    const price = Number(fields[5]);
    if (Number.isFinite(price)) prices.push(price);
  }
  return prices.length >= 23 ? prices : null;
}

/** El fichero de un día (YYYY-MM-DD) de omie.es. */
export const fetchOmieDay: OmieDayFetcher = async (date) => {
  const response = await fetch(`${OMIE_URL}${date.replace(/-/g, "")}.1`, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return parseOmieDay(await response.text());
};

/**
 * Festivos nacionales de fecha fija, en P3 todo el día. La CNMC (Circular
 * 3/2020) deja fuera los sustituibles y los de fecha variable (Viernes Santo).
 */
const HOLIDAYS = new Set(["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"]);

/** Periodo de la 2.0TD de una hora local (0–23) de un día (YYYY-MM-DD), en península. */
export function periodOf(date: string, hour: number): keyof EnergyByPeriod {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6 || HOLIDAYS.has(date.slice(5))) return "P3";
  if (hour < 8) return "P3";
  if ((hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)) return "P1";
  return "P2";
}

/**
 * Hora local de cada precio del día. Los días de cambio de hora tienen 23 o
 * 25 horas: en marzo no existe la hora de las 2; en octubre, la de las 2 se repite.
 */
function localHours(count: number): number[] {
  const perHour = count >= 92 ? 4 : 1;
  const hours = Math.round(count / perHour);
  return Array.from({ length: count }, (_, index) => {
    const slot = Math.floor(index / perHour);
    if (hours === 23) return slot < 2 ? slot : slot + 1;
    if (hours === 25) return slot < 3 ? slot : slot - 1;
    return slot;
  });
}

export interface PeriodSums {
  sum: EnergyByPeriod;
  count: EnergyByPeriod;
}

/** Suma y número de precios de un día por periodo. */
export function daySums(date: string, prices: OmieDay): PeriodSums {
  const sums: PeriodSums = { sum: { P1: 0, P2: 0, P3: 0 }, count: { P1: 0, P2: 0, P3: 0 } };
  const hours = localHours(prices.length);
  prices.forEach((price, index) => {
    const period = periodOf(date, hours[index]);
    sums.sum[period] += price;
    sums.count[period] += 1;
  });
  return sums;
}

/** Días entre dos fechas (YYYY-MM-DD), ambas incluidas. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86_400_000) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
}

export class MarketDataUnavailableError extends Error {
  constructor(readonly missingDays: string[]) {
    super(`Faltan precios de OMIE de ${missingDays.length} días (desde ${missingDays[0]})`);
    this.name = "MarketDataUnavailableError";
  }
}

/**
 * Media de OMIE por periodo (€/MWh) de varios tramos de fechas. Descarga cada
 * día una sola vez, de 24 en 24. Admite que falte algún día suelto (un
 * fichero que no carga), pero no más de un 3 % de los días.
 */
export async function omieAverages(
  ranges: readonly { from: string; to: string }[],
  fetchDay: OmieDayFetcher = fetchOmieDay,
): Promise<EnergyByPeriod[]> {
  const wanted = [...new Set(ranges.flatMap(({ from, to }) => daysBetween(from, to)))];
  const days = new Map<string, PeriodSums | null>();
  for (let start = 0; start < wanted.length; start += 24) {
    const batch = wanted.slice(start, start + 24);
    const results = await Promise.all(batch.map((date) => fetchDay(date).catch(() => null)));
    batch.forEach((date, index) => {
      const prices = results[index];
      days.set(date, prices ? daySums(date, prices) : null);
    });
  }
  const missing = wanted.filter((date) => !days.get(date));
  if (missing.length > Math.max(1, wanted.length * 0.03)) throw new MarketDataUnavailableError(missing);

  return ranges.map(({ from, to }) => {
    const total: PeriodSums = { sum: { P1: 0, P2: 0, P3: 0 }, count: { P1: 0, P2: 0, P3: 0 } };
    for (const date of daysBetween(from, to)) {
      const day = days.get(date);
      if (!day) continue;
      for (const period of ["P1", "P2", "P3"] as const) {
        total.sum[period] += day.sum[period];
        total.count[period] += day.count[period];
      }
    }
    // Un tramo sin horas de un periodo (solo fin de semana) toma la media del tramo.
    const all = (total.sum.P1 + total.sum.P2 + total.sum.P3) / Math.max(1, total.count.P1 + total.count.P2 + total.count.P3);
    const average = (period: keyof EnergyByPeriod) =>
      Math.round((total.count[period] > 0 ? total.sum[period] / total.count[period] : all) * 100) / 100;
    return { P1: average("P1"), P2: average("P2"), P3: average("P3") };
  });
}
