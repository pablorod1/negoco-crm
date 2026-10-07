/**
 * Interpretación de los valores de las celdas de un Excel de precios. La IA
 * solo dice de qué celda sale cada cosa; convertir «0,109000 €», «2.01P»,
 * «P1 <= 10kW» o «Inicio Enero27» es trabajo de este código, que no se
 * equivoca dos veces igual.
 */
import type { SheetCell } from "./grid";

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (reason: string): Parsed<never> => ({ ok: false, reason });

const BROKEN = /^#(REF|N\/A|VALUE|DIV\/0|NAME|NUM|NULL)!?/i;
const EMPTY = /^[-–—]?\s*(€|%|€\/kwh|€\/kw)?$/i;

/** Número de una celda: «0.173154 €», «0,109000», «1.000,50», «- €» (vacío). */
export function parseNumber(cell: SheetCell | null): Parsed<number | null> {
  if (!cell) return ok(null);
  if (typeof cell.value === "number") return ok(cell.value);
  const text = String(cell.value ?? cell.text).replace(/ /g, " ").trim();
  if (BROKEN.test(text)) return fail(`celda con error (${text})`);
  if (EMPTY.test(text)) return ok(null);
  const cleaned = text.replace(/[€%\s]|eur/gi, "");
  let normalized = cleaned;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(",", ".");
  }
  const value = Number(normalized);
  return Number.isFinite(value) && /^-?\d*\.?\d+$/.test(normalized)
    ? ok(value)
    : fail(`no es un número («${text}»)`);
}

/** Tarifa de acceso: «2.0TD», «20TD», «2.0 TD», «2.0TD_2…», «2.01P» (precio único). */
export function parseTariff(text: string): { tariff: string; singlePrice: boolean } | null {
  const match = /(\d)\s?[.,]?\s?(\d)\s?(TD|1P)/i.exec(text);
  if (!match) return null;
  return {
    tariff: `${match[1]}.${match[2]}TD`,
    singlePrice: match[3].toUpperCase() === "1P",
  };
}

/** Número dentro de una banda, con punto de miles («1.000», «50.000»). */
function bandNumber(raw: string): number {
  const cleaned = raw.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/\./g, ""));
  return Number(cleaned.replace(",", "."));
}

/**
 * Banda de potencia o de consumo a partir del texto: «P1 <= 10kW», «> 10kW y
 * ≤ 15kW», «10-15KW», «2.0TD 1.000 - 5.000», «> 50.000», «0-50.000 kWh/año»,
 * «<= 5 MWh/año». En consumo se devuelve en kWh.
 */
export function parseBand(
  text: string,
  kind: "kw" | "kwh",
): { min: number | null; max: number | null } | null {
  // Fuera la tarifa de acceso, que también lleva números.
  let rest = text.replace(/\b\d\s?[.,]?\s?\d\s?(TD|1P)\b/gi, " ").replace(/\bP\d\b/gi, " ");
  const scale = kind === "kwh" && /mwh/i.test(rest) ? 1000 : 1;
  rest = rest.replace(/≤|=<|<=/g, " <= ").replace(/≥|=>|>=/g, " >= ");
  const number = String.raw`(\d[\d.,]*)`;

  const range = new RegExp(`${number}\\s*(?:-|–|a|hasta)\\s*${number}`, "i").exec(rest);
  const lower = new RegExp(`(?:>=|>|desde|más de|mas de)\\s*${number}`, "i").exec(rest);
  const upper = new RegExp(`(?:<=|<|hasta|menos de)\\s*${number}`, "i").exec(rest);

  let min: number | null = null;
  let max: number | null = null;
  if (range && !/(<|>)/.test(rest.slice(0, range.index))) {
    min = bandNumber(range[1]);
    max = bandNumber(range[2]);
  } else {
    if (lower) min = bandNumber(lower[1]);
    if (upper) max = bandNumber(upper[1]);
  }
  if (min === null && max === null) return null;
  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
    return null;
  }
  return {
    min: min === null ? null : min * scale,
    max: max === null ? null : max * scale,
  };
}

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, apr: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, aug: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11,
  dic: 12, diciembre: 12, dec: 12,
};

const pad = (value: number) => String(value).padStart(2, "0");
const fullYear = (year: number) => (year < 100 ? 2000 + year : year);

/** Fecha de Excel (número de serie) a YYYY-MM-DD. */
export function excelSerialToDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** Todas las fechas de un texto, en orden: «del 01-10-2026 al 15-10-2026», «1 de octubre de 2026». */
export function parseDates(cell: SheetCell | null): string[] {
  if (!cell) return [];
  if (typeof cell.value === "number" && cell.value > 30_000 && cell.value < 80_000) {
    return [excelSerialToDate(cell.value)];
  }
  const text = String(cell.value ?? cell.text);
  const found: { index: number; date: string }[] = [];
  for (const match of text.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})/g)) {
    found.push({ index: match.index!, date: `${match[1]}-${pad(+match[2])}-${pad(+match[3])}` });
  }
  for (const match of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    // Formato español: día, mes, año.
    found.push({
      index: match.index!,
      date: `${fullYear(+match[3])}-${pad(+match[2])}-${pad(+match[1])}`,
    });
  }
  for (const match of text.matchAll(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/gi)) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month) found.push({ index: match.index!, date: `${match[3]}-${pad(month)}-${pad(+match[1])}` });
  }
  return found
    .filter(({ date }) => !Number.isNaN(Date.parse(date)))
    .sort((left, right) => left.index - right.index)
    .map(({ date }) => date);
}

/**
 * Mes de inicio del suministro: «Inicio Enero27», «Octubre 2026», «oct-26»,
 * una fecha. Devuelve el primer y el último día del mes.
 */
export function parseMonth(cell: SheetCell | null): { from: string; to: string } | null {
  if (!cell) return null;
  let year: number | null = null;
  let month: number | null = null;
  const dates = parseDates(cell);
  if (dates.length) {
    [year, month] = dates[0].split("-").map(Number);
  } else {
    const text = String(cell.value ?? cell.text).toLowerCase();
    const match = /([a-záéíóú]{3,10})[\s\-/]*'?(\d{2,4})/.exec(text);
    if (match && MONTHS[match[1]]) {
      month = MONTHS[match[1]];
      year = fullYear(Number(match[2]));
    }
  }
  if (!year || !month) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

/** Duración en meses: «24m», «60m / 12m», «12 meses», «2 años». */
export function parseTerm(text: string): number | null {
  const match = /(\d+)\s*(m|mes|meses|a|año|años)?\b/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return /^a/i.test(match[2] ?? "") ? value * 12 : value;
}

/** Territorio, también abreviado como lo escriben en las columnas de subsistema («PEN», «BAL»). */
export function parseTerritory(text: string): "peninsula" | "baleares" | "canarias" | "ceuta_melilla" | null {
  const lower = text.toLowerCase().trim();
  if (/balear|^bal\b/.test(lower)) return "baleares";
  if (/canari|^can\b/.test(lower)) return "canarias";
  if (/ceuta|melilla|^(ceu|mel)\b/.test(lower)) return "ceuta_melilla";
  if (/pen[ií]nsul|^pen\b/.test(lower)) return "peninsula";
  return null;
}

export function parseChannel(text: string): "acquisition" | "renewal" | null {
  if (/renova/i.test(text)) return "renewal";
  if (/capta|alta nueva|nuevos? (clientes|suministros)/i.test(text)) return "acquisition";
  return null;
}

export function parseBoolean(text: string): boolean | null {
  if (/^(true|s[ií]|1|yes)$/i.test(text.trim())) return true;
  if (/^(false|no|0)$/i.test(text.trim())) return false;
  return null;
}

export function parseEnergyUnit(text: string): "eur_kwh" | "cent_kwh" | "eur_mwh" | null {
  const lower = text.toLowerCase().replace(/\s/g, "");
  if (/eur_kwh|€\/kwh|eur\/kwh/.test(lower)) return "eur_kwh";
  if (/cent|c€/.test(lower)) return "cent_kwh";
  if (/mwh/.test(lower)) return "eur_mwh";
  return null;
}

export function parsePowerUnit(text: string): "eur_kw_day" | "eur_kw_month" | "eur_kw_year" | null {
  const lower = text.toLowerCase().replace(/\s/g, "");
  if (/day|d[ií]a/.test(lower)) return "eur_kw_day";
  if (/month|mes/.test(lower)) return "eur_kw_month";
  if (/year|a[ñn]o/.test(lower)) return "eur_kw_year";
  return null;
}
