import { Table } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { formatDate } from "./format";
import { ComparativaStatus } from "./types";

interface Props<TData> {
  table: Table<TData>;
  selectedColumnIds: string[];
  name: string;
}

const formatComparativaStatus = (status: ComparativaStatus) => {
  switch (status) {
    case "pending":
      return "Pendiente de Estudio";
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

        if (
          cell?.column.id === "Fecha de Activación" ||
          cell?.column.id === "Fecha de Renovación" ||
          cell?.column.id === "Fecha de Creación"
        ) {
          rowData[headerName] = cell.getValue()
            ? formatDate(cell.getValue() as string)
            : "---";
        } else if (cell?.column.id === "Comercial") {
          const value = cell?.getValue();

          if (typeof value === "object" && value !== null) {
            const userObject = value as {
              name: string;
              email: string;
              image: string;
            };
            // Format the object to a string

            rowData[headerName] = `${userObject.name} (${userObject.email})`;
          } else if (Array.isArray(value)) {
            rowData[headerName] = value.join(", ");
          } else {
            rowData[headerName] = value;
          }
        } else if (cell?.column.id === "Estado") {
          rowData[headerName] = formatComparativaStatus(
            cell?.getValue() as ComparativaStatus
          );
        } else if (
          cell?.column.id === "Comisión" ||
          cell?.column.id === "Comisión Comercial"
        ) {
          const value = cell?.getValue();
          if (typeof value === "object" && value !== null) {
            // Format commission based on plan type
            const comisionObj = value as {
              fijo: number;
              indexado: number;
            };

            // Create separate columns for fijo and indexado
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
        } else if (Array.isArray(cell?.getValue())) {
          rowData[headerName] = (cell?.getValue() as string[]).join(", ");
        } else {
          rowData[headerName] = cell?.getValue() ? cell.getValue() : "---";
        }
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
