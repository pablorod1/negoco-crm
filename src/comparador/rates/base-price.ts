import { energyOfTariff } from "@/comparador/gas/regulated";
import type { SheetGrid } from "./sheets/grid";
import type { ProposedRate } from "./types";
import { hasBlockingIssues, rowKey, type RateIssue } from "./validate";

/**
 * Precios base detectados en el texto de cada hoja, sin IA. Que un precio
 * admite el fee de la agencia lo dice a menudo una nota fuera de las tablas
 * («A estos precios base hay que incluirles el COE (Coste Operativo Eleia)»),
 * que una plantilla guardada no lee y la IA puede no ver. Si la hoja lo dice,
 * sus tarifas de precio fijo admiten fee.
 *
 * Solo marcas inequívocas: «a estos precios hay que añadirles los peajes» no
 * es un fee, ni lo es el fee de un producto indexado (ese ya va en su fila).
 */
const MARKERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bprecios?\s+base\b/, label: "precio base" },
  { pattern: /\bcoe\b|coste\s+operativo/, label: "COE (coste operativo)" },
  { pattern: /\+\s*fee\b/, label: "+ fee" },
  { pattern: /\bfee\s+(?:minimo|maximo)\b/, label: "fee mínimo" },
];

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** La expresión que delata un precio base en un texto; null si no hay ninguna. */
export function basePriceMarker(text: string): string | null {
  const normalized = plain(text);
  return MARKERS.find(({ pattern }) => pattern.test(normalized))?.label ?? null;
}

/** Por hoja, la expresión que dice que sus precios son base (una celda «FEE» de cabecera también). */
export function basePriceSheets(grids: readonly SheetGrid[]): Map<string, string> {
  const sheets = new Map<string, string>();
  for (const grid of grids) {
    const cells = grid.rows.flatMap((row) => row.flatMap((cell) => (cell?.text ? [cell.text] : [])));
    const marker =
      basePriceMarker(cells.join("\n")) ?? (cells.some((text) => plain(text).trim() === "fee") ? "columna FEE" : null);
    if (marker) sheets.set(grid.name, marker);
  }
  return sheets;
}

/** La hoja de una fila leída con plantilla: su fragmento empieza por «Hoja «X», fila N». */
const sheetOf = (row: Pick<ProposedRate, "sourceExcerpt">) => /^Hoja «(.+?)»/.exec(row.sourceExcerpt ?? "")?.[1] ?? null;

/**
 * Marca como precio base las tarifas de precio fijo de las hojas que lo dicen:
 * admiten el fee de la agencia (mínimo 0 si el anexo no da otro) y, en luz,
 * sin potencia en el anexo, llevan la regulada. Lo explica con un aviso.
 */
export function markBasePrices<T extends { proposed: ProposedRate[]; issues: RateIssue[]; status: "ok" | "needs_review" }>(
  result: T,
  sheets: ReadonlyMap<string, string>,
): T {
  if (sheets.size === 0) return result;
  const issues = [...result.issues];
  const marked = new Set<string>();
  const proposed = result.proposed.map((row) => {
    const sheet = sheetOf(row);
    const marker = sheet ? sheets.get(sheet) : undefined;
    if (!marker || row.pricing !== "fixed" || row.feeEnergyMinPerMwh !== null) return row;
    const key = rowKey(row);
    const electricity = energyOfTariff(row.accessTariff) !== "gas";
    const withoutPower = electricity && !row.powerStated;
    if (!marked.has(`${sheet}|${row.productName}`)) {
      marked.add(`${sheet}|${row.productName}`);
      issues.push({
        severity: "warning",
        code: "base_price",
        message: `${row.productName}: la hoja «${sheet}» habla de «${marker}»; se guarda como precio base, que admite el fee de la agencia.`,
        rowKey: key,
      });
    }
    if (!withoutPower) return { ...row, feeEnergyMinPerMwh: 0 };
    // Un precio base sin potencia lleva la regulada (Jorge, Beenergy): ya no falta.
    for (let index = issues.length - 1; index >= 0; index--) {
      if (issues[index].code === "missing_power" && issues[index].rowKey === key) issues.splice(index, 1);
    }
    issues.push({
      severity: "warning",
      code: "assumed_power",
      message: `${row.productName}: el anexo no da la potencia; al ser precio base, se usa la regulada (BOE).`,
      rowKey: key,
    });
    return {
      ...row,
      feeEnergyMinPerMwh: 0,
      powerMode: "regulated" as const,
      power: null,
      powerStated: true,
      sourceValues: { ...row.sourceValues, powerRule: "base_regulated" },
    };
  });
  return { ...result, proposed, issues, status: hasBlockingIssues(issues) ? "needs_review" : "ok" };
}
