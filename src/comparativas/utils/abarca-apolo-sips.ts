import type { AbarcaApoloSipsSummary } from "@/comparativas/types";
import { sanitizeCups } from "@/integrations/apolo-sips/cups";
import {
  summarizeElectricityConsumption,
  type ApoloSipsPeriodValues,
} from "@/integrations/apolo-sips/summary";
import type { ApoloSipsElectricityConsumptionRow } from "@/integrations/apolo-sips/types";

const PERIOD_KEYS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

export function createAbarcaApoloSipsSummary(
  cups: string,
  rows: ApoloSipsElectricityConsumptionRow[],
  fetchedAt = new Date().toISOString(),
): AbarcaApoloSipsSummary {
  const summary = summarizeElectricityConsumption(rows);

  return {
    cups: sanitizeCups(cups),
    fetched_at: fetchedAt,
    months: summary.rows.length,
    has_data: summary.rows.length > 0,
    max_demand_power_kw_by_period: summary.maxDemandPowerKwByPeriod,
  };
}

export function parseAbarcaApoloSipsSummary(
  rawPayload: string,
): AbarcaApoloSipsSummary | null {
  try {
    const parsed = JSON.parse(rawPayload) as { apolo_sips?: unknown };
    const apoloSips = parsed.apolo_sips;

    if (!isAbarcaApoloSipsSummary(apoloSips)) return null;
    return apoloSips;
  } catch {
    return null;
  }
}

export function attachApoloSipsToRawPayload(
  body: unknown,
  apoloSips: AbarcaApoloSipsSummary | null,
): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return JSON.stringify({
      ...body,
      apolo_sips: apoloSips,
    });
  }

  return JSON.stringify(body);
}

function isAbarcaApoloSipsSummary(
  value: unknown,
): value is AbarcaApoloSipsSummary {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.cups === "string" &&
    typeof candidate.fetched_at === "string" &&
    typeof candidate.months === "number" &&
    typeof candidate.has_data === "boolean" &&
    isPeriodValues(candidate.max_demand_power_kw_by_period)
  );
}

function isPeriodValues(value: unknown): value is ApoloSipsPeriodValues {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  return PERIOD_KEYS.every((period) => typeof candidate[period] === "number");
}
