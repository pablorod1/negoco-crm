import { roundEuros } from "./money";
import type { CostBreakdown } from "./types";

export interface PricedOffer<T> {
  offer: T;
  cost: CostBreakdown;
  /** Comisión de agencia en €, si la tarifa tiene regla. */
  commission: number | null;
}

export interface RankedOffer<T> extends PricedOffer<T> {
  /** Ahorro anual frente a la factura actual; negativo si sale más cara. */
  savings: number;
}

export interface Ranking<T> {
  offers: RankedOffer<T>[];
  /** Ninguna oferta mejora lo que el cliente paga hoy. */
  noSavings: boolean;
}

export type RankingOrder = "savings" | "commission";

/**
 * Ordena las ofertas por ahorro (o por comisión, a igualdad de ahorro por la
 * otra). Si ninguna ahorra, se marca para avisar en vez de recomendar.
 */
export function rankOffers<T>(
  current: CostBreakdown,
  offers: readonly PricedOffer<T>[],
  order: RankingOrder = "savings",
): Ranking<T> {
  const ranked = offers.map((priced) => ({
    ...priced,
    savings: roundEuros(current.total - priced.cost.total),
  }));

  const commissionOf = (offer: RankedOffer<T>) => offer.commission ?? -Infinity;
  ranked.sort((left, right) =>
    order === "savings"
      ? right.savings - left.savings ||
        commissionOf(right) - commissionOf(left)
      : commissionOf(right) - commissionOf(left) ||
        right.savings - left.savings,
  );

  return {
    offers: ranked,
    noSavings: ranked.every(({ savings }) => savings <= 0),
  };
}
