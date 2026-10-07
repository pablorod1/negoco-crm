import * as XLSX from "xlsx";
import { normalizeName } from "../names";

/**
 * Una hoja de cálculo como cuadrícula de celdas, con las coordenadas de Excel
 * (A1). Es lo que lee nuestro código al aplicar una plantilla: los precios
 * salen de las celdas, nunca de lo que escriba la IA.
 */
export interface SheetCell {
  /** Valor de la celda: número tal cual (sin redondeos de formato) o texto. */
  value: number | string | boolean | null;
  /** Texto tal como se ve en Excel. */
  text: string;
}

export interface SheetGrid {
  name: string;
  /** Filas desde la 1; `rows[0]` es la fila 1 de Excel. */
  rows: (SheetCell | null)[][];
}

/** Lee un libro de Excel o un CSV, solo valores (nunca fórmulas ni macros). */
export function readWorkbook(data: Uint8Array): SheetGrid[] {
  const book = XLSX.read(data, {
    type: "array",
    cellFormula: false,
    cellHTML: false,
    bookVBA: false,
  });
  return book.SheetNames.map((name) => {
    const sheet = book.Sheets[name];
    const ref = sheet["!ref"];
    if (!ref) return { name, rows: [] };
    const range = XLSX.utils.decode_range(ref);
    const rows: (SheetCell | null)[][] = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row: (SheetCell | null)[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        if (!cell || cell.v === undefined || cell.v === null || cell.v === "") {
          row.push(null);
          continue;
        }
        const value =
          typeof cell.v === "number" || typeof cell.v === "boolean"
            ? cell.v
            : cell.v instanceof Date
              ? cell.v.toISOString().slice(0, 10)
              : String(cell.v);
        const text = String(cell.w ?? cell.v).trim();
        row.push(text === "" ? null : { value, text });
      }
      rows.push(row);
    }
    return { name, rows };
  }).filter((grid) => grid.rows.some((row) => row.some(Boolean)));
}

export function columnLetter(index: number): string {
  return XLSX.utils.encode_col(index);
}

export function columnIndex(letter: string): number {
  return XLSX.utils.decode_col(letter.trim().toUpperCase());
}

/** Celda por referencia A1 (por ejemplo «D12»). */
export function cellAt(grid: SheetGrid, ref: string): SheetCell | null {
  const match = /^([A-Z]{1,3})(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  const row = Number(match[2]) - 1;
  return grid.rows[row]?.[columnIndex(match[1])] ?? null;
}

export function cellIn(grid: SheetGrid, row: number, column: string): SheetCell | null {
  return grid.rows[row - 1]?.[columnIndex(column)] ?? null;
}

/**
 * La hoja como texto con coordenadas, para que la IA pueda señalar filas y
 * columnas: `12| B=2.0TD_2 Plan Estable | C=39.99 | …`. Solo celdas con valor.
 */
export function renderGrid(
  grid: SheetGrid,
  maxChars = 40_000,
  { compactNumbers = false }: { compactNumbers?: boolean } = {},
): string {
  const lines = [`### Hoja «${grid.name}»`];
  let size = lines[0].length;
  // Para describir el formato basta la magnitud de cada número: con cuatro
  // cifras significativas el libro ocupa bastantes menos tokens.
  const show = (cell: SheetCell) =>
    compactNumbers && typeof cell.value === "number" && !Number.isInteger(cell.value)
      ? String(Number(cell.value.toPrecision(4)))
      : cell.text.replace(/\s+/g, " ").slice(0, 80);
  grid.rows.forEach((row, index) => {
    const cells = row
      .map((cell, column) => (cell ? `${columnLetter(column)}=${show(cell)}` : null))
      .filter(Boolean);
    if (cells.length === 0) return;
    const line = `${index + 1}| ${cells.join(" | ")}`;
    size += line.length + 1;
    if (size <= maxChars) lines.push(line);
  });
  if (size > maxChars) lines.push(`[… hoja recortada: ${grid.rows.length} filas en total …]`);
  return lines.join("\n");
}

/** Texto plano de la hoja (para clasificar y para los fragmentos de origen). */
export function gridText(grid: SheetGrid): string {
  return grid.rows
    .map((row) => row.map((cell) => cell?.text ?? "").join("\t").replace(/\t+$/, ""))
    .filter((line) => line.trim())
    .join("\n");
}

/**
 * Firma de la forma del libro: nombres de hoja normalizados. Dos envíos de la
 * misma comercializadora con la misma firma probablemente comparten plantilla;
 * si no encaja, la comprobación al aplicarla lo detecta.
 */
export function workbookSignature(grids: readonly SheetGrid[]): string {
  return grids
    .map((grid) => sheetShape(grid.name))
    .sort()
    .join("|");
}

/** Nombre de hoja sin números: «Precios y13.2026» y «Precios y14.2026» son la misma hoja. */
const sheetShape = (name: string) => normalizeName(name.replace(/\d+/g, ""));

/**
 * La hoja de un libro a la que se refiere una plantilla: por su nombre exacto,
 * normalizado o, si la comercializadora numera la hoja con la edición, sin los
 * números (solo si eso no deja dos candidatas).
 */
export function findSheet(grids: readonly SheetGrid[], name: string): SheetGrid | undefined {
  const exact =
    grids.find((grid) => grid.name === name) ??
    grids.find((grid) => normalizeName(grid.name) === normalizeName(name));
  if (exact) return exact;
  const sameShape = grids.filter((grid) => sheetShape(grid.name) === sheetShape(name));
  return sameShape.length === 1 ? sameShape[0] : undefined;
}
