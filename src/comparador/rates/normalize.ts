import { DAYS_PER_YEAR } from "@/comparador/engine/cost";
import { cleanName, looksIndexed, productKeyOf, productNameOf } from "./names";
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

const plainText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Servicios de ajuste: «SS.AA.», «servicios de ajuste», «Serv. Ajuste», «costes de Red Eléctrica». */
const ANCILLARY = String.raw`(?:serv(?:icios?|\.)?\s*(?:de\s+)?ajuste|ss\.?\s?aa\.?|ssaa|costes? de (?:la )?red electrica)`;
const ANCILLARY_EXCLUDED = new RegExp(
  `${ANCILLARY}[^.\\n]{0,40}\\bno\\s+(?:estan\\s+)?incluid|\\bsin\\s+(?:los\\s+)?${ANCILLARY}`,
);
const ANCILLARY_INCLUDED = new RegExp(
  `${ANCILLARY}[^.\\n]{0,20}(?<!\\bno\\s)\\bincluid|\\bcon\\s+(?:los\\s+)?${ANCILLARY}`,
);

/**
 * Si el precio incluye los servicios de ajuste. Manda lo que diga el nombre
 * del producto (INER: «EXPANSA (Serv. Ajuste NO INCLUIDOS)»); si no, lo que
 * diga el documento cuando solo dice que no van incluidos (Nordy: «Costes de
 * Red Eléctrica no incluidos»), en Península, que es donde se cobran. La IA
 * lo leía unas veces sí y otras no, y sin nadie que revise no puede depender
 * de eso: un precio sin ellos saldría más barato de lo que es.
 */
export function ancillaryIncluded(
  rate: Pick<ExtractedRate, "productName" | "ancillaryIncluded" | "territory">,
  text: string | null,
): boolean {
  const name = plainText(rate.productName);
  if (ANCILLARY_EXCLUDED.test(name)) return false;
  if (ANCILLARY_INCLUDED.test(name)) return true;
  if (text && (rate.territory ?? "peninsula") === "peninsula") {
    const plain = plainText(text);
    if (ANCILLARY_EXCLUDED.test(plain) && !ANCILLARY_INCLUDED.test(plain)) return false;
  }
  return rate.ancillaryIncluded ?? true;
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
    // La IA a veces deja como fijo un producto que por su nombre es indexado.
    const pricing = rate.pricing === "fixed" && looksIndexed(productName) ? "indexed" : rate.pricing;

    return {
      productName,
      productKey: productKeyOf(productName),
      accessTariff: rate.accessTariff.replace(/\s+/g, "").toUpperCase(),
      pricing,
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
      // La energía de una indexada es la del mercado de cada mes (el histórico):
      // lo que traiga el anexo (un término B, un margen) queda en sourceValues.
      energy: pricing === "indexed" ? null : normalizeEnergy(rate),
      includesAncillaryServices: ancillaryIncluded(rate, sourceText),
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
 * Reglas de comisión que pueden aplicarse a 2.0TD de precio fijo o indexado;
 * el producto se casa después con la tarifa. Una comisión sin tarifa de
 * acceso solo vale si el documento trae filas 2.0TD: en el preciario de APOLO,
 * el «65 % del fee» era de 3.0TD, 6.1TD e indexados. Las de la sección de
 * indexados solo se aplican a las indexadas, y al revés.
 */
export function toProposedCommissions(
  extraction: Pick<RateDocumentExtraction, "commissions" | "rates">,
): (Omit<CommissionRuleInput, "rateId"> & {
  productName: string | null;
  productKey: string | null;
})[] {
  const has20 = extraction.rates.some(
    (rate) => (rate.pricing === "fixed" || rate.pricing === "indexed") && /^2[.,]?0\s?TD$/i.test(rate.accessTariff.trim()),
  );
  return extraction.commissions
    .filter((rule) =>
      rule.accessTariff
        ? /^2[.,]?0\s?TD$/i.test(rule.accessTariff.trim())
        : has20,
    )
    .map((rule) => ({
    productName: rule.productName ? productNameOf(rule.productName) : null,
    productKey: rule.productName ? productKeyOf(productNameOf(rule.productName)) : null,
    product: rule.productName ? productNameOf(rule.productName) : null,
    accessTariff: rule.accessTariff?.replace(/\s+/g, "").toUpperCase() ?? null,
    pricing: rule.pricing ?? null,
    level: rule.level ? cleanName(rule.level) : null,
    channel: rule.channel === "both" ? null : rule.channel,
    minAnnualKwh: rule.minKwh,
    maxAnnualKwh: rule.maxKwh,
    minKw: rule.minKw ?? null,
    maxKw: rule.maxKw ?? null,
    ruleType: rule.ruleType,
    feeBase: rule.feeBase ?? "energy",
    amount: rule.amount,
    minAmount: rule.ruleType === "per_mwh" ? (rule.minAmount ?? null) : null,
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
export function appearsInText(value: number, numbers: Set<number>, text: string | null = null): boolean {
  if (numbers.has(round9(value))) return true;
  if (!text) return false;
  // Algunos PDF salen con las cifras pegadas («0,1648660,1969670,2745892.0TD»
  // en el de Imagina): la cifra está, aunque no como número suelto.
  const written = String(round9(value));
  return written.includes(".") && (text.includes(written) || text.includes(written.replace(".", ",")));
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Si una fecha (YYYY-MM-DD) aparece en el texto del documento, escrita de
 * cualquiera de las formas habituales: 01/10/2026, 1-10-26, 2026-10-01,
 * «1 de octubre de 2026», «1 de octubre» o, para el día 1, «octubre 2026».
 */
export function dateInText(iso: string, text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const [, year, month, day] = match;
  const plain = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const d = String(Number(day));
  const m = String(Number(month));
  const monthName = MONTHS[Number(month) - 1];
  const shortYear = year.slice(2);
  const days = `0?${d}`;
  const months = `0?${m}`;
  const years = `(?:${year}|${shortYear})`;
  const patterns = [
    `(?<!\\d)${days}[/.-]${months}[/.-]${years}(?!\\d)`,
    `(?<!\\d)${year}[/.-]${months}[/.-]${days}(?!\\d)`,
    `(?<!\\d)${days}\\s+de\\s+${monthName}(?![a-z])`,
    ...(d === "1"
      ? [`${monthName}\\s*(?:de\\s+|-|/)?\\s*${years}(?!\\d)`, `(?<!\\d)${months}[/.-]${year}(?!\\d)`]
      : []),
  ];
  return patterns.some((pattern) => new RegExp(pattern).test(plain));
}
