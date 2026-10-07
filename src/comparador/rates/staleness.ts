/**
 * Aviso de comercializadoras sin actualizar y tiempo hasta aprobar una
 * ingesta. Muchas comercializadoras cambian precios cada semana o cada
 * quincena; un mes sin versión nueva ya merece mirarse.
 */
export const STALE_AFTER_DAYS = 30;

/** Objetivo del plan: aprobar un anexo en menos de 24 horas desde que llega. */
export const APPROVAL_TARGET_HOURS = 24;

export type Freshness = "never" | "fresh" | "stale";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string): number {
  // Turso guarda CURRENT_TIMESTAMP como «YYYY-MM-DD HH:MM:SS» en UTC.
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const time = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : iso);
  if (Number.isNaN(time)) throw new RangeError(`Fecha no válida: ${value}`);
  return time;
}

export function freshness(
  lastUpdatedAt: string | null,
  now: Date = new Date(),
  staleAfterDays = STALE_AFTER_DAYS,
): { status: Freshness; days: number | null } {
  if (!lastUpdatedAt) return { status: "never", days: null };
  const days = Math.floor((now.getTime() - parseDate(lastUpdatedAt)) / DAY_MS);
  return { status: days > staleAfterDays ? "stale" : "fresh", days };
}

/** Mediana de horas entre la llegada y la decisión (aprobada o rechazada). */
export function medianDecisionHours(
  ingests: readonly { receivedAt: string; decidedAt: string | null }[],
): number | null {
  const hours = ingests
    .filter((ingest) => ingest.decidedAt)
    .map(
      (ingest) =>
        (parseDate(ingest.decidedAt!) - parseDate(ingest.receivedAt)) / 3_600_000,
    )
    .sort((left, right) => left - right);
  if (hours.length === 0) return null;
  const middle = Math.floor(hours.length / 2);
  const median =
    hours.length % 2 ? hours[middle] : (hours[middle - 1] + hours[middle]) / 2;
  return Math.round(median * 10) / 10;
}
