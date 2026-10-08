import { roundEuros } from "./money";

export interface CommissionRuleForEngine {
  rateId: string | null;
  /**
   * Producto tal como lo nombra el anexo de comisiones («Helsinki», «Clásico
   * 1 precio»). Vale para las tarifas cuyo nombre lo contiene; null = todas.
   */
  product?: string | null;
  accessTariff: string | null;
  level: string | null;
  channel: "acquisition" | "renewal" | null;
  minAnnualKwh: number | null;
  maxAnnualKwh: number | null;
  /** Potencia contratada (la mayor de P1 y P2), en kW: «2.0TD > 10 kW». */
  minKw?: number | null;
  maxKw?: number | null;
  ruleType: "fixed" | "per_mwh" | "fee_share";
  /** Con fee_share: porcentaje del fee de energía (por defecto) o del de potencia. */
  feeBase?: "energy" | "power";
  amount: number;
  /** Con per_mwh: comisión mínima en € («se cobra la mínima salvo que consumo × coeficiente la supere»). */
  minAmount?: number | null;
  /** YYYY-MM-DD. */
  validFrom: string;
  validTo: string | null;
}

export interface CommissionContext {
  rateId: string;
  /** Nombre de la tarifa («Helsinki II», «PRECIO FIJO PRESENCIALES SBC 12M L4»). */
  productName?: string;
  accessTariff: string;
  level: string | null;
  channel: "acquisition" | "renewal" | null;
  annualKwh: number;
  /** La mayor potencia contratada, en kW. */
  maxContractedKw?: number;
  /** Fee de energía elegido, en €/MWh (para las reglas fee_share). */
  feeEnergyPerMwh: number;
  /** Fee de potencia elegido, en €/kW·año, y los kW a los que se aplica (P1 + P2). */
  feePowerPerKwYear?: number;
  contractedKwTotal?: number;
  /** Fecha del estudio (YYYY-MM-DD). */
  date: string;
}

/**
 * Palabras de un nombre sin tildes, mayúsculas ni signos, y sin la tarifa de
 * acceso: «2.0TD Clásico (1 precio)» → clasico, 1, precio. El «+» cuenta como
 * palabra: «TULUZ PRO+» es otro producto que «TULUZ PRO».
 */
export function nameTokens(text: string | null | undefined): string[] {
  return (text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b[236][.,]?[01]\s?td\b/g, " ")
    .replace(/\+/g, " plus ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Si unas palabras aparecen seguidas dentro de un nombre. También juntas:
 * «Super cliente» está en «SUPERCLIENTE L8», y «Agencia» en «AGENCIA LO»,
 * pero «Cliente» no está en «SUPERCLIENTE» ni «I» en «II».
 */
export function containsPhrase(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0) return true;
  const compact = needle.join("");
  for (let start = 0; start < haystack.length; start++) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return true;
    let joined = "";
    for (let end = start; end < haystack.length && joined.length < compact.length; end++) {
      joined += haystack[end];
      if (joined === compact) return true;
    }
  }
  return false;
}

/** El nivel de la regla puede estar en el nivel del precio o en el nombre de la tarifa («Helsinki II»). */
function levelMatches(level: string, context: CommissionContext): boolean {
  const wanted = nameTokens(level);
  return containsPhrase(nameTokens(context.level), wanted) || containsPhrase(nameTokens(context.productName), wanted);
}

function matches(rule: CommissionRuleForEngine, context: CommissionContext) {
  if (rule.validFrom > context.date) return false;
  if (rule.validTo && rule.validTo < context.date) return false;
  if (rule.rateId && rule.rateId !== context.rateId) return false;
  if (!rule.rateId && rule.product && !containsPhrase(nameTokens(context.productName), nameTokens(rule.product))) {
    return false;
  }
  if (rule.accessTariff && rule.accessTariff !== context.accessTariff) return false;
  if (rule.level && !levelMatches(rule.level, context)) return false;
  if (rule.channel && context.channel && rule.channel !== context.channel) return false;
  // Tramos de consumo como en los anexos: incluyen el mínimo y excluyen el
  // máximo («0 – 10 MWh», «10 – 15 MWh»).
  if (rule.minAnnualKwh !== null && context.annualKwh < rule.minAnnualKwh) return false;
  if (rule.maxAnnualKwh !== null && context.annualKwh >= rule.maxAnnualKwh) return false;
  // Sin la potencia no se puede comprobar «> 10 kW»: no se aplica.
  if ((rule.minKw ?? null) !== null || (rule.maxKw ?? null) !== null) {
    const kw = context.maxContractedKw;
    if (kw === undefined) return false;
    if (rule.minKw != null && kw <= rule.minKw) return false;
    if (rule.maxKw != null && kw > rule.maxKw) return false;
  }
  return true;
}

/**
 * Cuánto concreta una regla, de más a menos: la tarifa enlazada, el producto
 * (más palabras, más concreto: «La Tarifa Justa Cloud» antes que «La Tarifa
 * Justa»), el nivel, la potencia, el canal y la tarifa de acceso.
 */
function specificity(rule: CommissionRuleForEngine): number[] {
  return [
    rule.rateId ? 1 : 0,
    rule.rateId ? 0 : nameTokens(rule.product).length,
    rule.level ? 1 : 0,
    rule.minKw != null || rule.maxKw != null ? 1 : 0,
    rule.channel ? 1 : 0,
    rule.accessTariff ? 1 : 0,
  ];
}

function compareSpecificity(left: number[], right: number[]): number {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function amountOf(rule: CommissionRuleForEngine, context: CommissionContext): number {
  const mwh = context.annualKwh / 1000;
  if (rule.ruleType === "fixed") return roundEuros(rule.amount);
  if (rule.ruleType === "per_mwh") return roundEuros(Math.max(rule.amount * mwh, rule.minAmount ?? 0));
  // Porcentaje de lo que el fee aporta en un año.
  const feeRevenue =
    rule.feeBase === "power"
      ? (context.feePowerPerKwYear ?? 0) * (context.contractedKwTotal ?? 0)
      : context.feeEnergyPerMwh * mwh;
  return roundEuros((feeRevenue * rule.amount) / 100);
}

/** Si una regla se aplica a una tarifa, sin mirar consumo, potencia ni fechas: para la revisión. */
export function ruleCoversRate(
  rule: Pick<CommissionRuleForEngine, "rateId" | "product" | "level">,
  rate: { rateId: string; productName: string; level: string | null },
): boolean {
  const context = { productName: rate.productName, level: rate.level } as CommissionContext;
  if (rule.rateId ? rule.rateId !== rate.rateId : rule.product && !containsPhrase(nameTokens(rate.productName), nameTokens(rule.product))) {
    return false;
  }
  return !rule.level || levelMatches(rule.level, context);
}

/**
 * Comisión de agencia en € para una oferta. Si varias reglas encajan, manda
 * la más concreta y, a igualdad, la más reciente. Si aun así quedan varias
 * con importes distintos (un anexo leído sin el producto, por ejemplo), no se
 * adivina: `null`, como sin regla, y el ranking lo muestra como «sin comisión
 * conocida».
 */
export function computeCommission(
  rules: readonly CommissionRuleForEngine[],
  context: CommissionContext,
): number | null {
  const candidates = rules
    .filter((candidate) => matches(candidate, context))
    .map((rule) => ({ rule, rank: specificity(rule) }))
    .sort(
      (left, right) =>
        compareSpecificity(right.rank, left.rank) || right.rule.validFrom.localeCompare(left.rule.validFrom),
    );
  const best = candidates[0];
  if (!best) return null;
  const tied = candidates.filter(
    ({ rule, rank }) => compareSpecificity(rank, best.rank) === 0 && rule.validFrom === best.rule.validFrom,
  );
  const amounts = new Set(tied.map(({ rule }) => amountOf(rule, context)));
  return amounts.size === 1 ? [...amounts][0] : null;
}
