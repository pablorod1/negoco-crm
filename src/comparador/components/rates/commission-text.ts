import type { CommissionRuleInput } from "@/comparador/rates/types";

type RuleText = Pick<
  CommissionRuleInput,
  | "product"
  | "accessTariff"
  | "level"
  | "channel"
  | "minAnnualKwh"
  | "maxAnnualKwh"
  | "minKw"
  | "maxKw"
  | "ruleType"
  | "amount"
  | "minAmount"
>;

const kw = (value: number) => `${value.toLocaleString("es-ES")} kW`;

/** «Helsinki · 2.0TD · II · > 10 kW · 0–2 MWh · Captación», o «Todas las tarifas». */
export function commissionScope(rule: RuleText, { withConsumption = true } = {}): string {
  const power =
    rule.minKw !== null && rule.maxKw !== null
      ? `${kw(rule.minKw)}–${kw(rule.maxKw)}`
      : rule.minKw !== null
        ? `> ${kw(rule.minKw)}`
        : rule.maxKw !== null
          ? `≤ ${kw(rule.maxKw)}`
          : null;
  const consumption =
    withConsumption && (rule.minAnnualKwh !== null || rule.maxAnnualKwh !== null)
      ? `${(rule.minAnnualKwh ?? 0) / 1000}–${rule.maxAnnualKwh === null ? "∞" : rule.maxAnnualKwh / 1000} MWh`
      : null;
  const channel = rule.channel === "renewal" ? "Renovación" : rule.channel ? "Captación" : null;
  return (
    [rule.product, rule.accessTariff, rule.level, power, consumption, channel].filter(Boolean).join(" · ") ||
    "Todas las tarifas"
  );
}

/** «200 €», «15 €/MWh (mínimo 75 €)», «50 % del fee». */
export function commissionAmount(rule: RuleText): string {
  if (rule.ruleType === "fixed") return `${rule.amount} €`;
  if (rule.ruleType === "per_mwh") {
    return rule.minAmount !== null ? `${rule.amount} €/MWh (mínimo ${rule.minAmount} €)` : `${rule.amount} €/MWh`;
  }
  return `${rule.amount} % del fee`;
}
