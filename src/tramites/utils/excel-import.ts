import type * as XLSXTypes from "xlsx";
import type { ExcelParseResult, ImportedCUPS } from "@/tramites/types";

async function loadXLSX(): Promise<typeof XLSXTypes> {
  return await import("xlsx");
}

const CUPS_REGEX = /^ES\d{16}[A-Z]{2}\d{0,2}$/;

const CUPS_HEADER_PATTERNS = [
  /^cups$/i,
  /^cup$/i,
  /^c\.?u\.?p\.?s\.?$/i,
  /código.*cups/i,
  /cups.*suministro/i,
  /punto.*suministro/i,
];

const COMMISSION_HEADER_PATTERNS = [
  /^comisi[oó]n$/i,
  /^comision$/i,
  /^commission$/i,
  /^fee$/i,
  /comisi[oó]n.*agente/i,
  /comisi[oó]n.*comercial/i,
  /^retribuci[oó]n$/i,
];

/** Sanitize a raw CUPS string: trim, remove inner spaces/dashes, uppercase */
export function sanitizeCups(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

/** Check if a string looks like a valid Spanish CUPS code */
export function isValidCups(cups: string): boolean {
  return CUPS_REGEX.test(cups);
}

/** Detect which column contains CUPS data by analyzing headers and rows */
function detectCupsColumn(headers: string[], rows: string[][]): number {
  // 1. Match by header name
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]?.trim() ?? "";
    if (CUPS_HEADER_PATTERNS.some((p) => p.test(h))) return i;
  }

  // 2. Match by data pattern — pick column with highest CUPS-valid ratio
  let bestCol = -1;
  let bestRatio = 0;
  const sampleRows = rows.slice(0, Math.min(20, rows.length));

  for (let col = 0; col < headers.length; col++) {
    const total = sampleRows.length;
    if (total === 0) continue;
    const valid = sampleRows.filter((row) =>
      isValidCups(sanitizeCups(row[col] ?? "")),
    ).length;
    const ratio = valid / total;
    if (ratio > 0.4 && ratio > bestRatio) {
      bestRatio = ratio;
      bestCol = col;
    }
  }

  return bestCol;
}

/** Detect which column contains commission data by header name */
function detectCommissionColumn(headers: string[]): number | null {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]?.trim() ?? "";
    if (COMMISSION_HEADER_PATTERNS.some((p) => p.test(h))) return i;
  }
  return null;
}

/** Parse a raw cell value into a numeric commission */
function parseCommissionValue(raw: string): number | null {
  if (!raw) return null;
  // Handle formats: "12,50", "12.50", "€12.50", "12,50€", "12.50 €"
  const cleaned = raw.replace(/[€$\s]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Parse an Excel/CSV file and extract CUPS data */
export async function parseExcelFile(
  file: ArrayBuffer,
  sheetIndex = 0,
): Promise<ExcelParseResult> {
  const XLSX = await loadXLSX();
  const workbook = XLSX.read(file, { type: "array" });
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error("El archivo no contiene hojas de datos.");
  }

  const targetSheet = sheetIndex < sheetNames.length ? sheetIndex : 0;
  const sheet = workbook.Sheets[sheetNames[targetSheet]];
  const rawData: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    rawNumbers: false,
  });

  if (rawData.length < 2) {
    throw new Error(
      "El archivo no contiene datos suficientes (se necesita al menos una fila de cabecera y una de datos).",
    );
  }

  const headers = rawData[0].map((h) => String(h).trim());
  const dataRows = rawData
    .slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));

  const detectedColumn = detectCupsColumn(headers, dataRows);
  const commissionColumn = detectCommissionColumn(headers);

  if (detectedColumn === -1) {
    return {
      cups: [],
      headers,
      detectedColumn: -1,
      commissionColumn,
      sheetNames,
      totalRows: dataRows.length,
      previewRows: dataRows.slice(0, 5).map((r) => r.map(String)),
    };
  }

  const cups = extractCupsFromColumn(
    dataRows,
    detectedColumn,
    headers,
    commissionColumn,
  );

  return {
    cups,
    headers,
    detectedColumn,
    commissionColumn,
    sheetNames,
    totalRows: dataRows.length,
    previewRows: dataRows.slice(0, 5).map((r) => r.map(String)),
  };
}

/** Extract CUPS from a specific column, with deduplication tracking */
function extractCupsFromColumn(
  rows: string[][],
  colIndex: number,
  headers: string[],
  commissionColIndex?: number | null,
): ImportedCUPS[] {
  const result: ImportedCUPS[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i][colIndex];
    const cups = sanitizeCups(String(raw ?? ""));
    if (!cups) continue;

    const extraData: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (idx !== colIndex && header) {
        extraData[header] = String(rows[i][idx] ?? "");
      }
    });

    const commission =
      commissionColIndex != null
        ? parseCommissionValue(String(rows[i][commissionColIndex] ?? ""))
        : null;

    result.push({
      cups,
      rowIndex: i + 2, // +2 because: +1 for 0-index, +1 for header row
      commission,
      extraData,
    });
  }

  return result;
}

/** Deduplicate CUPS and return unique ones + duplicate entries */
export function deduplicateCups(cupsList: ImportedCUPS[]): {
  unique: ImportedCUPS[];
  duplicates: string[];
} {
  const seen = new Map<string, ImportedCUPS>();
  const duplicates: string[] = [];

  for (const item of cupsList) {
    if (seen.has(item.cups)) {
      if (!duplicates.includes(item.cups)) {
        duplicates.push(item.cups);
      }
    } else {
      seen.set(item.cups, item);
    }
  }

  return {
    unique: Array.from(seen.values()),
    duplicates,
  };
}

/** Re-parse with a different column selection */
export async function reparseWithColumn(
  file: ArrayBuffer,
  sheetIndex: number,
  columnIndex: number,
  commissionColumnIndex?: number | null,
): Promise<ExcelParseResult> {
  const XLSX = await loadXLSX();
  const workbook = XLSX.read(file, { type: "array" });
  const sheetNames = workbook.SheetNames;
  const targetSheet = sheetIndex < sheetNames.length ? sheetIndex : 0;
  const sheet = workbook.Sheets[sheetNames[targetSheet]];
  const rawData: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    rawNumbers: false,
  });

  const headers = rawData[0].map((h) => String(h).trim());
  const dataRows = rawData
    .slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));

  // Use provided commission column or auto-detect
  const commissionColumn =
    commissionColumnIndex ?? detectCommissionColumn(headers);
  const cups = extractCupsFromColumn(
    dataRows,
    columnIndex,
    headers,
    commissionColumn,
  );

  return {
    cups,
    headers,
    detectedColumn: columnIndex,
    commissionColumn,
    sheetNames,
    totalRows: dataRows.length,
    previewRows: dataRows.slice(0, 5).map((r) => r.map(String)),
  };
}
