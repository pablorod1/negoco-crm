import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { cleanName, productKeyOf, productNameOf } from "./names";
import type { ExtractedRate, RateDocumentExtraction } from "./schema";
import type { CommissionRuleInput, ProposedRate, RateDiscount } from "./types";

type PowerUnit = NonNullable<ExtractedRate["powerUnit"]>;
type EnergyUnit = NonNullable<ExtractedRate["energyUnit"]>;

/** Potencia a €/kW·día, la unidad del motor. */
export function powerToPerDay(value: number, unit: PowerUnit): number {
  if (unit === "eur_kw_month") return (value * 12) / DAYS_PER_YEAR;
  if (unit === "eur_kw_year") return value / DAYS_PER_YEAR;
  return value;
}

/** Energía a €/kWh, la unidad del motor. */
export function energyToPerKwh(value: number, unit: EnergyUnit): number {
  if (unit === "cent_kwh") return value / 100;
  if (unit === "eur_mwh") return value / 1000;
  return value;
}

/** Quita el ruido de coma flotante de las conversiones. */
function round9(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

function normalizeEnergy(rate: ExtractedRate): ProposedRate["energy"] {
  const unit = rate.energyUnit ?? "eur_kwh";
  const convert = (value: number | null) =>
    value === null ? null : round9(energyToPerKwh(value, unit));
  const p1 = convert(rate.energyP1);
  if (p1 === null) return null;

  // Un precio único vale para todas las horas: los anexos lo escriben solo en
  // P1 y dejan P2 y P3 vacíos o a cero (Repsol), y un cero sería luz gratis.
  if (rate.singlePrice) return { P1: p1, P2: p1, P3: p1 };

  const p2 = convert(rate.energyP2);
  const p3 = convert(rate.energyP3);
  if (p2 === null || p3 === null) return null;
  return { P1: p1, P2: p2, P3: p3 };
}

function normalizePower(rate: ExtractedRate) {
  if (rate.powerMode === "regulated" || rate.powerMode === "regulated_plus") {
    return {
      powerMode: rate.powerMode,
      powerMarginPerKwYear:
        rate.powerMode === "regulated_plus" ? rate.powerMargin : null,
      power: null,
      powerStated: true,
    } as const;
  }

  const unit = rate.powerUnit ?? "eur_kw_day";
  const stated =
    rate.powerMode === "fixed" && rate.powerP1 !== null && rate.powerP2 !== null;
  return {
    powerMode: "fixed",
    powerMarginPerKwYear: null,
    power: stated
      ? {
          P1: round9(powerToPerDay(rate.powerP1!, unit)),
          P2: round9(powerToPerDay(rate.powerP2!, unit)),
        }
      : null,
    powerStated: stated,
  } as const;
}

function normalizeDiscounts(rate: ExtractedRate): RateDiscount[] {
  return rate.discounts.map((discount) => ({
    kind: discount.kind,
    value: discount.value,
    months: discount.months,
    conditional: discount.conditional,
    text: cleanName(discount.text),
  }));
}

/** Cifras de la fila tal como venían en el documento. */
function copiedValues(rate: ExtractedRate): number[] {
  return [
    rate.energyP1,
    rate.energyP2,
    rate.energyP3,
    rate.powerP1,
    rate.powerP2,
    rate.powerMargin,
  ].filter((value): value is number => typeof value === "number" && value !== 0);
}

/**
 * La línea del documento que contiene más cifras de la fila: es lo que se
 * enseña junto a cada precio al aprobar. En una hoja, la línea es la fila.
 */
export function findExcerpt(
  lines: readonly { text: string; numbers: Set<number> }[],
  values: readonly number[],
): string {
  let best: { text: string; hits: number } | null = null;
  for (const line of lines) {
    const hits = values.filter((value) => appearsInText(value, line.numbers)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { text: line.text, hits };
  }
  return best ? cleanName(best.text).slice(0, 300) : "";
}

export function indexLines(text: string | null) {
  if (!text) return [];
  return text
    .split("\n")
    .filter((line) => /\d/.test(line))
    .map((line) => ({ text: line.replace(/\t+/g, " · "), numbers: numbersInText(line) }));
}

/** Convierte las filas extraídas a filas propuestas, en las unidades del motor. */
export function toProposedRates(
  extraction: Pick<RateDocumentExtraction, "rates">,
  sourceText: string | null = null,
): ProposedRate[] {
  const lines = indexLines(sourceText);

  return extraction.rates.map((rate) => {
    const power = normalizePower(rate);
    const productName = productNameOf(rate.productName);

    return {
      productName,
      productKey: productKeyOf(productName),
      accessTariff: rate.accessTariff.replace(/\s+/g, "").toUpperCase(),
      pricing: rate.pricing,
      level: rate.level ? cleanName(rate.level) : null,
      territory: rate.territory ?? "peninsula",
      channel: rate.channel === "both" ? null : rate.channel,
      clientSegment: rate.segment ? cleanName(rate.segment) : null,
      minPowerKw: rate.minKw,
      maxPowerKw: rate.maxKw,
      minAnnualKwh: rate.minKwh,
      maxAnnualKwh: rate.maxKwh,
      supplyStartFrom: rate.startFrom,
      supplyStartTo: rate.startTo,
      termMonths: rate.months,
      ...power,
      energy: normalizeEnergy(rate),
      includesAncillaryServices: rate.ancillaryIncluded ?? true,
      feeEnergyMinPerMwh: rate.feeMinMwh,
      feeEnergyMaxPerMwh: rate.feeMaxMwh,
      feePowerAllowed: rate.feeOnPower,
      discounts: normalizeDiscounts(rate),
      sourceExcerpt: findExcerpt(lines, copiedValues(rate)),
      sourceValues: {
        powerUnit: rate.powerUnit,
        powerP1: rate.powerP1,
        powerP2: rate.powerP2,
        powerMargin: rate.powerMargin,
        energyUnit: rate.energyUnit,
        energyP1: rate.energyP1,
        energyP2: rate.energyP2,
        energyP3: rate.energyP3,
      },
    };
  });
}

/**
 * Reglas de comisión que pueden aplicarse a 2.0TD de precio fijo; el producto
 * se casa después con la tarifa. Una comisión sin tarifa de acceso solo vale
 * si el documento trae filas 2.0TD fijas: en el preciario de APOLO, el «65 %
 * del fee» era de 3.0TD, 6.1TD e indexados.
 */
export function toProposedCommissions(
  extraction: Pick<RateDocumentExtraction, "commissions" | "rates">,
): (Omit<CommissionRuleInput, "rateId"> & {
  productName: string | null;
  productKey: string | null;
})[] {
  const hasFixed20 = extraction.rates.some(
    (rate) => rate.pricing === "fixed" && /^2[.,]?0\s?TD$/i.test(rate.accessTariff.trim()),
  );
  return extraction.commissions
    .filter((rule) => rule.pricing !== "indexed")
    .filter((rule) =>
      rule.accessTariff
        ? /^2[.,]?0\s?TD$/i.test(rule.accessTariff.trim())
        : hasFixed20,
    )
    .map((rule) => ({
    productName: rule.productName ? productNameOf(rule.productName) : null,
    productKey: rule.productName ? productKeyOf(productNameOf(rule.productName)) : null,
    accessTariff: rule.accessTariff?.replace(/\s+/g, "").toUpperCase() ?? null,
    level: rule.level ? cleanName(rule.level) : null,
    channel: rule.channel === "both" ? null : rule.channel,
    minAnnualKwh: rule.minKwh,
    maxAnnualKwh: rule.maxKwh,
    ruleType: rule.ruleType,
    feeBase: rule.feeBase ?? "energy",
    amount: rule.amount,
  }));
}

/**
 * Todos los números que aparecen en un texto, leídos con coma o punto
 * decimal. «1.000» puede ser mil o uno, así que se guardan las dos lecturas.
 */
export function numbersInText(text: string): Set<number> {
  const found = new Set<number>();
  for (const match of text.matchAll(/\d[\d.,]*/g)) {
    const token = match[0].replace(/[.,]+$/, "");
    if (!token) continue;
    const candidates = new Set<string>();
    // Celdas pegadas por comas («43.990000,28.990000» en un CSV): cada trozo
    // cuenta por separado.
    if (token.includes(".") && token.includes(",")) {
      for (const piece of token.split(/,+/)) {
        if (/^\d+(\.\d+)?$/.test(piece)) candidates.add(piece);
      }
    }
    if (/^\d+$/.test(token)) candidates.add(token);
    // Un solo separador: es el decimal.
    if (/^\d+[.,]\d+$/.test(token)) candidates.add(token.replace(",", "."));
    // Separadores de miles con punto y decimal con coma, o al revés.
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(token))
      candidates.add(token.replace(/\./g, "").replace(",", "."));
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(token))
      candidates.add(token.replace(/,/g, ""));
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value)) found.add(round9(value));
    }
  }
  return found;
}

/** El valor aparece en el texto, admitiendo ceros de más o de menos al final. */
export function appearsInText(value: number, numbers: Set<number>): boolean {
  return numbers.has(round9(value));
}
