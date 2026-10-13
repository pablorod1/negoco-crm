import type { PowerByPeriod } from "./types";

/**
 * Por debajo de esta fracción de uso la potencia se considera
 * sobredimensionada (confirmado por Beenergy, 2026-10-13).
 */
export const OVERSIZED_USAGE_RATIO = 0.75;

/**
 * Margen sobre la contratada a partir del cual la potencia se da por baja. En
 * 2.0TD no hay excesos que se cobren: solo salta el limitador, así que una
 * demanda algo por encima no merece aviso (Beenergy, 2026-10-13).
 */
export const LOW_POWER_MARGIN_KW = 0.5;

export type PowerStatus = "exceeded" | "adequate" | "oversized";

export interface PowerAssessment {
  status: PowerStatus;
  contractedKw: number;
  maxDemandKw: number;
  /** Potencia sugerida, redondeada hacia arriba a 0,1 kW. */
  suggestedKw: number;
}

/**
 * Compara la máxima demanda registrada (SIPS, últimos 12 meses) con la
 * potencia contratada. Si la demanda supera la contratada en más de
 * `LOW_POWER_MARGIN_KW`, la potencia es baja y se avisa.
 */
export function assessPower(
  contractedKw: PowerByPeriod,
  maxDemandKwByPeriod: readonly number[],
): PowerAssessment | null {
  const maxDemandKw = Math.max(0, ...maxDemandKwByPeriod);
  if (maxDemandKw <= 0) return null;

  const contracted = Math.max(contractedKw.P1, contractedKw.P2);
  const suggestedKw = Math.ceil(maxDemandKw * 10 - 1e-9) / 10;

  let status: PowerStatus = "adequate";
  if (maxDemandKw > contracted + LOW_POWER_MARGIN_KW) status = "exceeded";
  else if (maxDemandKw < contracted * OVERSIZED_USAGE_RATIO) {
    status = "oversized";
  }

  return { status, contractedKw: contracted, maxDemandKw, suggestedKw };
}
