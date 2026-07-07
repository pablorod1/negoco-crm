import {
  getExpectedApoloSipsColumns,
  NUMERIC_APOLO_SIPS_COLUMNS,
} from "./columns";
import type { ParsedCsv } from "./csv";
import type {
  ApoloSipsProcedure,
  ApoloSipsProcedureResult,
  ApoloSipsProcedureRow,
  ApoloSipsSupplyType,
} from "./types";

export class ApoloSipsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApoloSipsParseError";
  }
}

export function normalizeApoloSipsColumnName(column: string): string {
  return column
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeApoloSipsCsv(
  parsedCsv: ParsedCsv,
  procedure: ApoloSipsProcedure,
  supplyType: ApoloSipsSupplyType,
): ApoloSipsProcedureResult<ApoloSipsProcedureRow> {
  const normalizedColumns = parsedCsv.columns.map(normalizeApoloSipsColumnName);
  assertExpectedColumns(normalizedColumns, procedure, supplyType);

  const rows = parsedCsv.rows.map((row) =>
    normalizeApoloSipsRow(row, normalizedColumns),
  );

  return {
    procedure,
    supplyType,
    columns: parsedCsv.columns,
    rows,
    rowCount: rows.length,
    hasData: rows.length > 0,
  };
}

function assertExpectedColumns(
  columns: string[],
  procedure: ApoloSipsProcedure,
  supplyType: ApoloSipsSupplyType,
): void {
  const actual = new Set(columns);
  const missing = getExpectedApoloSipsColumns(procedure, supplyType).filter(
    (column) => !actual.has(column),
  );

  if (missing.length > 0) {
    throw new ApoloSipsParseError(
      `Respuesta SIPS inválida: faltan columnas (${missing.join(", ")}).`,
    );
  }
}

function normalizeApoloSipsRow(
  row: string[],
  normalizedColumns: string[],
): ApoloSipsProcedureRow {
  const normalized: Record<string, string | number | null> = {};

  for (let index = 0; index < normalizedColumns.length; index += 1) {
    const column = normalizedColumns[index];
    const rawValue = row[index] ?? "";
    const value = rawValue.trim();

    if (!value) {
      normalized[column] = null;
      continue;
    }

    normalized[column] = NUMERIC_APOLO_SIPS_COLUMNS.has(column)
      ? parseApoloSipsNumber(value, column)
      : value;
  }

  return normalized as unknown as ApoloSipsProcedureRow;
}

function parseApoloSipsNumber(value: string, column: string): number {
  const normalized = normalizeNumberString(value);
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new ApoloSipsParseError(
      `Valor numérico inválido en la columna ${column}.`,
    );
  }

  return parsed;
}

function normalizeNumberString(value: string): string {
  const trimmed = value.replace(/\s/g, "");
  const commaIndex = trimmed.lastIndexOf(",");
  const dotIndex = trimmed.lastIndexOf(".");

  if (commaIndex === -1 && dotIndex === -1) {
    return trimmed;
  }

  if (commaIndex > dotIndex) {
    return trimmed.replace(/\./g, "").replace(",", ".");
  }

  if (dotIndex > commaIndex && commaIndex !== -1) {
    return trimmed.replace(/,/g, "");
  }

  if (commaIndex !== -1) {
    return trimmed.replace(",", ".");
  }

  return trimmed;
}
