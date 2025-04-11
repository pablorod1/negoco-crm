import { Table } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { formatComission, formatDate } from "./format";
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

      // First, check if there's a plan column to reference later
      let plan: string | string[] | undefined;
      selectedColumnIds.forEach((columnId) => {
        if (columnId === "Plan") {
          const planCell = row
            .getAllCells()
            .find((cell) => cell.column.id === columnId);
          plan = planCell?.getValue() as string | string[] | undefined;
        }
      });

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
          rowData[headerName] = formatDate(cell?.getValue() as string);
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

            if (plan) {
              // If plan is an array, show both values
              if (
                Array.isArray(plan) &&
                plan.includes("fijo") &&
                plan.includes("indexado")
              ) {
                rowData[headerName] =
                  `Fijo: ${formatComission(comisionObj.fijo) || 0}, Indexado: ${formatComission(comisionObj.indexado) || 0}`;
              }
              // If plan is "fijo" or includes "fijo" but not "indexado", only show fijo
              else if (
                plan === "fijo" ||
                (Array.isArray(plan) && plan.includes("fijo"))
              ) {
                rowData[headerName] =
                  `Fijo: ${formatComission(comisionObj.fijo) || 0}`;
              }
              // If plan is "indexado" or includes "indexado" but not "fijo", only show indexado
              else if (
                plan === "indexado" ||
                (Array.isArray(plan) && plan.includes("indexado"))
              ) {
                rowData[headerName] =
                  `Indexado: ${formatComission(comisionObj.indexado) || 0}`;
              }
              // Fallback if plan doesn't match expected values
              else {
                rowData[headerName] =
                  `Fijo: ${formatComission(comisionObj.fijo) || 0}, Indexado: ${formatComission(comisionObj.indexado) || 0}`;
              }
            } else {
              // If there's no plan information, show both values
              rowData[headerName] =
                `Fijo: ${formatComission(comisionObj.fijo) || 0}, Indexado: ${formatComission(comisionObj.indexado) || 0}`;
            }
          } else if (Array.isArray(value)) {
            rowData[headerName] = value.join(", ");
          } else {
            rowData[headerName] = Number(value);
          }
        } else if (Array.isArray(cell?.getValue())) {
          rowData[headerName] = (cell?.getValue() as string[]).join(", ");
        } else {
          rowData[headerName] = cell?.getValue();
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
