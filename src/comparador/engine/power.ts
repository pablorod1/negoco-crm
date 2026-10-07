import type { PowerByPeriod } from "./types";

/**
 * Por debajo de esta fracción de uso la potencia se considera
 * sobredimensionada. Es una propuesta inicial, a validar con Beenergy.
 */
export const OVERSIZED_USAGE_RATIO = 0.75;

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
 * potencia contratada. Si la demanda supera la contratada, el suministro va
 * justo y se avisa: es lo que el análisis de Abarca daba por «adecuado».
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
  if (maxDemandKw > contracted) status = "exceeded";
  else if (maxDemandKw < contracted * OVERSIZED_USAGE_RATIO) {
    status = "oversized";
  }

  return { status, contractedKw: contracted, maxDemandKw, suggestedKw };
}
