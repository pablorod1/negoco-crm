import type { CommissionRuleInput } from "@/comparador/rates/types";

type RuleText = Pick<
  CommissionRuleInput,
  | "product"
  | "accessTariff"
  | "energy"
  | "pricing"
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

/** «Helsinki · 2.0TD · Precio fijo · II · > 10 kW · 0–2 MWh · Captación», o «Todas las tarifas». */
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
  // «RL.1» solo no dice que es gas.
  const tariff = rule.accessTariff && rule.energy === "gas" ? `Gas ${rule.accessTariff}` : rule.accessTariff;
  // Eleia paga distinto la misma tarifa a precio fijo y a indexado.
  const pricing = rule.pricing === "indexed" ? "Indexado" : rule.pricing === "fixed" ? "Precio fijo" : null;
  const channel = rule.channel === "renewal" ? "Renovación" : rule.channel ? "Captación" : null;
  return (
    [rule.product, tariff, pricing, rule.level, power, consumption, channel].filter(Boolean).join(" · ") ||
    "Todas las tarifas"
  );
}

/** 18,78 y no 18.782609: los anexos en Excel guardan la cifra sin redondear. */
const number = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 2 });

/** «200 €», «15 €/MWh (mínimo 75 €)», «50 % del fee». */
export function commissionAmount(rule: RuleText): string {
  if (rule.ruleType === "fixed") return `${number(rule.amount)} €`;
  if (rule.ruleType === "per_mwh") {
    return rule.minAmount !== null
      ? `${number(rule.amount)} €/MWh (mínimo ${number(rule.minAmount)} €)`
      : `${number(rule.amount)} €/MWh`;
  }
  return `${number(rule.amount)} % del fee`;
}
