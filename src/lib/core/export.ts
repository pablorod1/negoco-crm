import { Table } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { formatDate } from "./format";

interface Props<TData> {
  table: Table<TData>;
  selectedColumnIds: string[];
  name: string;
}

export async function exportToExcel<TData>({
  table,
  selectedColumnIds,
  name,
}: Props<TData>) {
  try {
    // Obtener las filas
    const rows = table.getRowModel().rows;
    // Crear un array de objetos para el workbook
    const workbookData = rows.map((row) => {
      const rowData: Record<string, unknown> = {};
      selectedColumnIds.forEach((columnId) => {
        const cell = row
          .getAllCells()
          .find((cell) => cell.column.id === columnId);
        const column = table.getColumn(columnId);
        // Usar el header de la columna como clave o el ID si no hay header
        const headerName =
          typeof column?.columnDef.header === "function"
            ? columnId
            : (column?.columnDef.header as string) || columnId;
        rowData[headerName] =
          cell?.column.id === "Fecha de Activación" ||
          cell?.column.id === "Fecha de Renovación" ||
          cell?.column.id === "Fecha de Creación"
            ? formatDate(cell?.getValue() as string)
            : Array.isArray(cell?.getValue())
            ? (cell?.getValue() as string[]).join(", ")
            : cell?.getValue();
      });
      return rowData;
    });

    // Crear un nuevo workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(workbookData);

    // Añadir la hoja al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, name);

    // Generar el archivo y descargarlo
    XLSX.writeFile(workbook, `${name}.xlsx`);

    return { success: true, data: workbookData };
  } catch (error) {
    console.error("Error al exportar a Excel:", error);
    return { success: false, error: "Error al exportar a Excel" };
  }
}
