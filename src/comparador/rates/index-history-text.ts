import type { EnergyByPeriod } from "@/comparador/engine/types";

/** Unidad en la que vienen los precios del histórico. */
export type HistoryUnit = "eur_kwh" | "cent_kwh" | "eur_mwh";

export const HISTORY_UNITS: Record<HistoryUnit, { label: string; toEurKwh: number }> = {
  eur_kwh: { label: "€/kWh", toEurKwh: 1 },
  cent_kwh: { label: "c€/kWh", toEurKwh: 0.01 },
  eur_mwh: { label: "€/MWh", toEurKwh: 0.001 },
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** Los Excel en inglés («Jan-26», «Aug-26», Eleia): los que no empiezan igual que en español. */
const ENGLISH_MONTHS: Record<string, number> = { jan: 0, apr: 3, aug: 7, dec: 11 };

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** «2025-05», «05/2025», «5-2025», «may-25», «Mayo 2025», «Aug-26» → «2025-05»; null si no es un mes. */
export function parseMonth(raw: string): string | null {
  const text = plain(raw.trim());
  const pad = (month: number) => String(month).padStart(2, "0");
  const year = (value: string) => (value.length === 2 ? 2000 + Number(value) : Number(value));
  let match = text.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return `${match[1]}-${pad(Number(match[2]))}`;
  match = text.match(/^(\d{1,2})[-/.](\d{4}|\d{2})$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) return `${year(match[2])}-${pad(Number(match[1]))}`;
  match = text.match(/^([a-z]{3,10})\.?[\s\-/.]*(?:de\s+)?(\d{4}|\d{2})$/);
  if (match) {
    const spanish = MONTHS.findIndex((name) => match![1].startsWith(name) || (name === "sep" && match![1].startsWith("set")));
    const index = spanish >= 0 ? spanish : (ENGLISH_MONTHS[match[1].slice(0, 3)] ?? -1);
    if (index >= 0) return `${year(match[2])}-${pad(index + 1)}`;
  }
  return null;
}

/** «0,1234», «0.1234», «1.234,5» → número; null si no lo es. */
function parseNumber(raw: string): number | null {
  const text = raw.trim().replace(/[€\s]/g, "");
  if (!text) return null;
  const normalized = /,\d+$/.test(text) ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export interface ParsedHistory {
  months: { month: string; energy: EnergyByPeriod }[];
  /** Líneas que no se han entendido, con su número (desde 1). */
  problems: string[];
}

/**
 * Lee un histórico pegado desde una hoja o un documento: una línea por mes con
 * el mes y el precio de punta, llano y valle (o uno solo para las 24 horas),
 * separados por tabuladores, punto y coma o espacios. Las líneas de cabecera
 * («Mes P1 P2 P3») se saltan sin avisar.
 */
export function parseHistoryText(text: string, unit: HistoryUnit): ParsedHistory {
  const factor = HISTORY_UNITS[unit].toEurKwh;
  const months = new Map<string, EnergyByPeriod>();
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    let cells = line.split(/\t|;/).map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2) {
      // Separado por espacios: el mes puede ser una palabra («2025-05») o dos («Mayo 2025»).
      const words = line.trim().split(/\s+/);
      cells = words.length > 2 && parseMonth(`${words[0]} ${words[1]}`) ? [`${words[0]} ${words[1]}`, ...words.slice(2)] : words;
    }
    const month = cells.length ? parseMonth(cells[0]) : null;
    if (!month) {
      // Una cabecera no tiene cifras.
      if (!/\d[.,]\d/.test(line)) return;
      problems.push(`Línea ${index + 1}: no empieza por un mes («${cells[0] ?? line.trim()}»).`);
      return;
    }
    const values = cells.slice(1).map(parseNumber);
    if (values.some((value) => value === null) || (values.length !== 1 && values.length !== 3)) {
      problems.push(`Línea ${index + 1}: hacen falta tres precios (punta, llano y valle) o uno para las 24 horas.`);
      return;
    }
    const [p1, p2, p3] = values.length === 1 ? [values[0]!, values[0]!, values[0]!] : (values as number[]);
    const round = (value: number) => Math.round(value * factor * 1e6) / 1e6;
    months.set(month, { P1: round(p1), P2: round(p2), P3: round(p3) });
  });
  return {
    months: [...months].sort(([left], [right]) => left.localeCompare(right)).map(([month, energy]) => ({ month, energy })),
    problems,
  };
}

/** Meses entre dos (YYYY-MM), ambos incluidos. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.split("-").map(Number);
  const [lastYear, lastMonth] = to.split("-").map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** «may 2025». */
export function formatMonth(month: string): string {
  const [year, number] = month.split("-");
  return `${MONTHS[Number(number) - 1]} ${year}`;
}
