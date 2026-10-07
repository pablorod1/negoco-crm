import { roundEuros } from "./money";

export interface CommissionRuleForEngine {
  rateId: string | null;
  accessTariff: string | null;
  level: string | null;
  channel: "acquisition" | "renewal" | null;
  minAnnualKwh: number | null;
  maxAnnualKwh: number | null;
  ruleType: "fixed" | "per_mwh" | "fee_share";
  /** Con fee_share: porcentaje del fee de energía (por defecto) o del de potencia. */
  feeBase?: "energy" | "power";
  amount: number;
  /** YYYY-MM-DD. */
  validFrom: string;
  validTo: string | null;
}

export interface CommissionContext {
  rateId: string;
  accessTariff: string;
  level: string | null;
  channel: "acquisition" | "renewal" | null;
  annualKwh: number;
  /** Fee de energía elegido, en €/MWh (para las reglas fee_share). */
  feeEnergyPerMwh: number;
  /** Fee de potencia elegido, en €/kW·año, y los kW a los que se aplica (P1 + P2). */
  feePowerPerKwYear?: number;
  contractedKwTotal?: number;
  /** Fecha del estudio (YYYY-MM-DD). */
  date: string;
}

function matches(rule: CommissionRuleForEngine, context: CommissionContext) {
  if (rule.validFrom > context.date) return false;
  if (rule.validTo && rule.validTo < context.date) return false;
  if (rule.rateId && rule.rateId !== context.rateId) return false;
  if (rule.accessTariff && rule.accessTariff !== context.accessTariff) return false;
  if (rule.level && rule.level.toLowerCase() !== context.level?.toLowerCase()) {
    return false;
  }
  if (rule.channel && context.channel && rule.channel !== context.channel) return false;
  // Tramos de consumo como en los anexos: incluyen el mínimo y excluyen el
  // máximo («0 – 10 MWh», «10 – 15 MWh»).
  if (rule.minAnnualKwh !== null && context.annualKwh < rule.minAnnualKwh) return false;
  if (rule.maxAnnualKwh !== null && context.annualKwh >= rule.maxAnnualKwh) return false;
  return true;
}

/** Una regla de una tarifa concreta manda sobre cualquier regla general. */
function specificity(rule: CommissionRuleForEngine): number {
  return (
    (rule.rateId ? 8 : 0) +
    (rule.level ? 4 : 0) +
    (rule.channel ? 2 : 0) +
    (rule.accessTariff ? 1 : 0)
  );
}

/**
 * Comisión de agencia en € para una oferta. Si varias reglas encajan, manda
 * la más concreta (tarifa, después nivel, canal y tarifa de acceso) y, a
 * igualdad, la más reciente. Sin
 * regla aplicable, `null`: el ranking lo muestra como «sin comisión conocida».
 */
export function computeCommission(
  rules: readonly CommissionRuleForEngine[],
  context: CommissionContext,
): number | null {
  const rule = rules
    .filter((candidate) => matches(candidate, context))
    .sort(
      (left, right) =>
        specificity(right) - specificity(left) ||
        right.validFrom.localeCompare(left.validFrom),
    )[0];
  if (!rule) return null;

  const mwh = context.annualKwh / 1000;
  if (rule.ruleType === "fixed") return roundEuros(rule.amount);
  if (rule.ruleType === "per_mwh") return roundEuros(rule.amount * mwh);
  // Porcentaje de lo que el fee aporta en un año.
  const feeRevenue =
    rule.feeBase === "power"
      ? (context.feePowerPerKwYear ?? 0) * (context.contractedKwTotal ?? 0)
      : context.feeEnergyPerMwh * mwh;
  return roundEuros((feeRevenue * rule.amount) / 100);
}
