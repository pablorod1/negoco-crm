export interface ParsedCsv {
  columns: string[];
  rows: string[][];
}

export class ApoloSipsCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApoloSipsCsvError";
  }
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  let cellStartedWithQuote = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
        continue;
      }

      if (!inQuotes && currentCell.length === 0) {
        cellStartedWithQuote = true;
        inQuotes = true;
        continue;
      }

      if (inQuotes) {
        inQuotes = false;
        continue;
      }
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      cellStartedWithQuote = false;
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      cellStartedWithQuote = false;
      continue;
    }

    if (!inQuotes && cellStartedWithQuote && char.trim() !== "") {
      throw new ApoloSipsCsvError("Formato CSV inválido.");
    }

    currentCell += char;
  }

  if (inQuotes) {
    throw new ApoloSipsCsvError("CSV con comillas sin cerrar.");
  }

  currentRow.push(currentCell);

  const isLastRowEmpty =
    currentRow.length === 1 && currentRow[0].trim().length === 0;
  if (!isLastRowEmpty) {
    rows.push(currentRow);
  }

  const nonEmptyRows = rows.filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );

  if (nonEmptyRows.length === 0) {
    throw new ApoloSipsCsvError("CSV sin cabecera.");
  }

  const [columns, ...dataRows] = nonEmptyRows;

  return {
    columns: columns.map((column) => column.trim()),
    rows: dataRows,
  };
}
