import type { RateDiscount } from "./types";

/**
 * Una parte de un descuento de tarifa tal como la aplica el comparador. Un
 * descuento del anexo puede traer varias: «15% s/Te (+5% PyS Tier 1 +2% PyS
 * Tier 2)» son un 15 % sobre la energía y dos condicionados.
 */
export interface DiscountPart {
  /** «índice del descuento.índice de la parte»: identifica la parte en la oferta. */
  key: string;
  text: string;
  base: "energy" | "power" | "energy_power" | "fixed";
  /** Porcentaje (15 = 15 %) o, con `fixed`, euros. */
  value: number;
  /** Meses que dura; null = todo el contrato. */
  months: number | null;
  /** Depende de algo que el comparador no sabe (contratar servicios, ACP…). */
  conditional: boolean;
}

export interface DiscountReading {
  parts: DiscountPart[];
  /** Descuentos que no se pueden aplicar, con el motivo. Se enseñan, no restan. */
  informative: { text: string; reason: string }[];
}

const ENERGY = /s\/\s*te\b|\bte\b|t[ée]rmino de energ|energ[íi]a|consumo/i;
const POWER = /s\/\s*tp\b|\btp\b|potencia/i;
const SECOND_YEAR = /\b(?:2|segundo)\s*[ºo°]?\s*a[ñn]o|a[ñn]o\s*2\b/i;
/** El descuento depende de cuándo se consume: no se sabe sin la curva horaria. */
const BY_TIME = /d[íi]as? vacacional|fines? de semana|franja|horas? (?:elegid|promocion)|festivos/i;
const CONDITION = /\bsi\b|contrat/i;

function baseOf(text: string): DiscountPart["base"] | null {
  const energy = ENERGY.test(text);
  const power = POWER.test(text);
  if (energy && power) return "energy_power";
  if (energy) return "energy";
  if (power) return "power";
  return null;
}

/** «15%», «15,5 %», «15.0%» → números. */
function percents(text: string): number[] {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((match) => Number(match[1].replace(",", ".")));
}

function euros(text: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:€|eur\b|euros)/i.exec(text);
  return match ? Number(match[1].replace(",", ".")) : null;
}

/** Trozos de un texto separados por «+», sin vacíos. */
const pieces = (text: string) =>
  text
    .split("+")
    .map((piece) => piece.trim())
    .filter(Boolean);

/**
 * Lee un descuento escrito a mano en el anexo. La parte de fuera de los
 * paréntesis se aplica siempre; la de dentro son extras condicionados. Lo
 * que no se puede saber (solo el segundo año, según la hora de consumo,
 * varios porcentajes posibles, un porcentaje sin decir sobre qué) no se aplica.
 */
function readText(discount: RateDiscount, index: number): DiscountReading {
  const original = discount.text.trim();
  // Se conserva cómo lo escribe el anexo («20% s/Te»): las reglas no distinguen mayúsculas.
  const text = original.replace(/\s+/g, " ");
  const reading: DiscountReading = { parts: [], informative: [] };
  // Un texto se enseña una sola vez, con el primer motivo.
  const skip = (reason: string) => {
    if (!reading.informative.some((item) => item.text === original)) reading.informative.push({ text: original, reason });
  };

  if (/^s\/?\s*dto\.?$|^sin descuento$/i.test(text)) return reading;
  if (BY_TIME.test(text)) {
    skip("Depende de cuándo consume el cliente");
    return reading;
  }

  const inner = [...text.matchAll(/\(([^)]*)\)/g)].map((match) => match[1]);
  const outer = text.replace(/\([^)]*\)/g, " ");
  let mainBase: DiscountPart["base"] | null = null;
  let part = 0;
  const add = (piece: string, conditional: boolean) => {
    if (SECOND_YEAR.test(piece)) return;
    const values = percents(piece);
    if (values.length > 1) {
      skip("Varios porcentajes posibles");
      return;
    }
    if (values.length === 1) {
      const base = baseOf(piece) ?? (conditional ? mainBase : null);
      if (!base) {
        skip("No dice sobre qué se aplica: suele ser informativo (precio ya con descuento)");
        return;
      }
      if (!conditional) mainBase ??= base;
      reading.parts.push({
        key: `${index}.${part++}`,
        text: piece.replace(/\s+/g, " "),
        base,
        value: values[0],
        months: discount.months,
        conditional: conditional || (discount.conditional && CONDITION.test(piece)),
      });
      return;
    }
    const amount = euros(piece);
    if (amount !== null) {
      reading.parts.push({
        key: `${index}.${part++}`,
        text: piece,
        base: "fixed",
        value: amount,
        months: null,
        conditional: conditional || CONDITION.test(piece),
      });
    }
  };
  for (const piece of pieces(outer)) add(piece, /\bsi\b/i.test(piece));
  for (const group of inner) for (const piece of pieces(group)) add(piece, true);

  if (reading.parts.length === 0 && reading.informative.length === 0) {
    skip("Sin un importe que el comparador pueda aplicar");
  }
  return reading;
}

/**
 * Las partes de los descuentos de una tarifa que el comparador puede aplicar.
 * Los estructurados del anexo se aplican tal cual; los que solo traen texto
 * («15% s/Te (+5% PyS Tier 1)») se leen con reglas fijas, nunca con la IA.
 */
export function readDiscounts(discounts: readonly RateDiscount[]): DiscountReading {
  const reading: DiscountReading = { parts: [], informative: [] };
  discounts.forEach((discount, index) => {
    const percent = discount.value !== null && discount.value > 0 && discount.value <= 1 ? discount.value * 100 : discount.value;
    const structured =
      discount.kind === "energy_percent" ? "energy" : discount.kind === "power_percent" ? "power" : discount.kind === "fixed_amount" ? "fixed" : null;
    if (structured && percent !== null && percent > 0) {
      reading.parts.push({
        key: `${index}.0`,
        text: discount.text,
        base: structured,
        value: structured === "fixed" ? (discount.value ?? 0) : percent,
        months: discount.months,
        conditional: discount.conditional,
      });
      return;
    }
    if (discount.kind === "other" && discount.value === null) {
      const text = readText(discount, index);
      reading.parts.push(...text.parts);
      reading.informative.push(...text.informative);
      return;
    }
    reading.informative.push({ text: discount.text, reason: "Sin un importe que el comparador pueda aplicar" });
  });
  return reading;
}

/** Parte del año que cuenta un descuento: los temporales, sus meses. */
export const shareOfYear = (months: number | null) => (months === null || months <= 0 ? 1 : Math.min(months, 12) / 12);
