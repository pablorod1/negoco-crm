import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import type { RegulatedParams } from "@/comparador/engine/regulated";
import type { TariffPrices } from "@/comparador/engine/types";
import type { RateConditions, RatePrices, RateChannel, Territory } from "./types";

/**
 * Precios de una fila tal como los usa el motor. La potencia regulada se
 * resuelve con los peajes y cargos vigentes en la fecha del estudio.
 */
export function toTariffPrices(
  row: Pick<RatePrices, "powerMode" | "powerMarginPerKwYear" | "power" | "energy">,
  regulated: Pick<RegulatedParams, "regulatedPowerPerKwYear">,
): TariffPrices | null {
  if (!row.energy) return null;

  if (row.powerMode === "fixed") {
    return row.power ? { power: row.power, energy: row.energy } : null;
  }

  const margin =
    row.powerMode === "regulated_plus" ? (row.powerMarginPerKwYear ?? 0) : 0;
  const { P1, P2 } = regulated.regulatedPowerPerKwYear;
  return {
    power: {
      P1: (P1 + margin) / DAYS_PER_YEAR,
      P2: (P2 + margin) / DAYS_PER_YEAR,
    },
    energy: row.energy,
  };
}

export interface SupplyForEligibility {
  /** La mayor de las potencias contratadas, en kW. */
  maxContractedKw: number;
  annualKwh: number;
  territory: Territory;
  /** Fecha prevista de inicio del suministro (YYYY-MM-DD). */
  supplyStart: string;
  channel: RateChannel | null;
}

/**
 * La fila se puede ofrecer a este suministro. La potencia se escribe en los
 * anexos como «≤ 10 kW» y «> 10 kW y ≤ 15 kW»: el mínimo es exclusivo y el
 * máximo inclusivo. El consumo, como «0 – 10 MWh» y «10 – 15 MWh»: el mínimo
 * es inclusivo y el máximo también, para no dejar fuera el valor frontera.
 */
export function isEligible(row: RateConditions, supply: SupplyForEligibility): boolean {
  if (row.territory !== supply.territory) return false;
  if (row.channel && supply.channel && row.channel !== supply.channel) return false;
  if (row.minPowerKw && supply.maxContractedKw <= row.minPowerKw) return false;
  if (row.maxPowerKw !== null && supply.maxContractedKw > row.maxPowerKw) return false;
  if (row.minAnnualKwh !== null && supply.annualKwh < row.minAnnualKwh) return false;
  if (row.maxAnnualKwh !== null && supply.annualKwh > row.maxAnnualKwh) return false;
  if (row.supplyStartFrom && supply.supplyStart < row.supplyStartFrom) return false;
  if (row.supplyStartTo && supply.supplyStart > row.supplyStartTo) return false;
  return true;
}
