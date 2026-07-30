import { Column, Table } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { formatDate } from "./format";
import { ComparativaStatus } from "@/core/types";

interface Props<TData> {
  table: Table<TData>;
  selectedColumnIds: string[];
  name: string;
}

interface RowsProps<TData> {
  table: Table<TData>;
  rows: Record<string, unknown>[];
  selectedColumnIds: string[];
  name: string;
}

/** Column id of the virtual "Notas" column: it exists only in the export. */
export const NOTES_COLUMN_ID = "Notas";

const formatComparativaStatus = (status: ComparativaStatus) => {
  switch (status) {
    case "pending":
      return "Pendiente de Estudio";
    case "processing":
      return "Procesando";
    case "completed":
      return "Estudio Realizado";
    case "processed":
      return "Completada";
    case "rejected":
      return "Rechazada";
    default:
      return status;
  }
};

/** Uses the column's static header as the Excel column name, id as fallback. */
const getHeaderName = <TData,>(
  column: Column<TData, unknown> | undefined,
  columnId: string,
): string =>
  typeof column?.columnDef.header === "function"
    ? columnId
    : (column?.columnDef.header as string) || columnId;

/**
 * Writes one column's value into the row object, applying the per-column
 * formatting rules. Shared by both export paths so a cell-based export and a
 * fetched-rows export can never format the same column differently.
 */
const writeColumnValue = (
  rowData: Record<string, unknown>,
  columnId: string,
  headerName: string,
  value: unknown,
) => {
  if (
    columnId === "Fecha de Activación" ||
    columnId === "Fecha de Renovación" ||
    columnId === "Fecha de Creación"
  ) {
    rowData[headerName] = value ? formatDate(value as string) : "---";
    return;
  }

  if (columnId === "Comercial") {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const userObject = value as { name: string; email: string };
      rowData[headerName] = `${userObject.name} (${userObject.email})`;
    } else if (Array.isArray(value)) {
      rowData[headerName] = value.join(", ");
    } else {
      rowData[headerName] = value;
    }
    return;
  }

  if (columnId === "Estado") {
    rowData[headerName] = formatComparativaStatus(value as ComparativaStatus);
    return;
  }

  if (columnId === "Comisión" || columnId === "Comisión Comercial") {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Commission split by plan type gets its own pair of columns
      const comisionObj = value as { fijo: number; indexado: number };

      const fijoHeaderName = headerName.includes("Comercial")
        ? "Comisión Comercial Fijo"
        : "Comisión Fijo";
      const indexadoHeaderName = headerName.includes("Comercial")
        ? "Comisión Comercial Indexado"
        : "Comisión Indexado";

      rowData[fijoHeaderName] = comisionObj.fijo || 0;
      rowData[indexadoHeaderName] = comisionObj.indexado || 0;
    } else if (Array.isArray(value)) {
      rowData[headerName] = value.join(", ");
    } else {
      rowData[headerName] = Number(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    rowData[headerName] = value.join(", ");
    return;
  }

  rowData[headerName] = value ? value : "---";
};

/** Builds the workbook and triggers the browser download. */
const writeWorkbook = (
  workbookData: Record<string, unknown>[],
  name: string,
) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(workbookData);

  // Notes hold several multi-line entries; without an explicit width the column
  // renders as an unreadable sliver.
  const headers = Object.keys(workbookData[0] ?? {});
  const notesIndex = headers.indexOf(NOTES_COLUMN_ID);
  if (notesIndex !== -1) {
    worksheet["!cols"] = headers.map((header, index) =>
      index === notesIndex ? { wch: 60 } : { wch: 18 },
    );
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, name);
  XLSX.writeFile(workbook, `${name}.xlsx`);
};

/**
 * Exports the rows currently rendered by the table, reading values off cells.
 */
export async function exportToExcel<TData>({
  table,
  selectedColumnIds,
  name,
}: Props<TData>) {
  try {
    const rows = table.getRowModel().rows;

    const workbookData = rows.map((row) => {
      const rowData: Record<string, unknown> = {};

      selectedColumnIds.forEach((columnId) => {
        const cell = row
          .getAllCells()
          .find((cell) => cell.column.id === columnId);
        const column = table.getColumn(columnId);
        const headerName = getHeaderName(column, columnId);

        writeColumnValue(rowData, columnId, headerName, cell?.getValue());
      });
      return rowData;
    });

    writeWorkbook(workbookData, name);

    return { success: true, data: workbookData };
  } catch (error) {
    console.error("Error al exportar a Excel:", error);
    return { success: false, error: "Error al exportar a Excel" };
  }
}

/**
 * Exports rows fetched from the server rather than the ones on screen, so the
 * file can cover every filtered record instead of just the current page.
 *
 * Values are resolved through each column's accessorKey, which keeps the Excel
 * headers and formatting identical to the on-screen export.
 */
export async function exportRowsToExcel<TData>({
  table,
  rows,
  selectedColumnIds,
  name,
}: RowsProps<TData>) {
  try {
    const workbookData = rows.map((row) => {
      const rowData: Record<string, unknown> = {};

      selectedColumnIds.forEach((columnId) => {
        // The notes column has no counterpart in the table: it is served
        // pre-formatted by the export endpoint.
        if (columnId === NOTES_COLUMN_ID) {
          rowData[NOTES_COLUMN_ID] = row.notes ? row.notes : "---";
          return;
        }

        const column = table.getColumn(columnId);
        const headerName = getHeaderName(column, columnId);
        const accessorKey = (
          column?.columnDef as { accessorKey?: string } | undefined
        )?.accessorKey;

        writeColumnValue(
          rowData,
          columnId,
          headerName,
          accessorKey ? row[accessorKey] : undefined,
        );
      });
      return rowData;
    });

    writeWorkbook(workbookData, name);

    return { success: true, data: workbookData };
  } catch (error) {
    console.error("Error al exportar a Excel:", error);
    return { success: false, error: "Error al exportar a Excel" };
  }
}
