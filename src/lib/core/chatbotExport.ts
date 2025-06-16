import * as XLSX from "xlsx";
import { formatDate } from "./format";
import { ComparativaStatus } from "./types";

// Column header translations from English to Spanish
const COLUMN_TRANSLATIONS: Record<string, string> = {
  // General fields
  id: "ID",
  name: "Nombre",
  last_name: "Apellidos",
  email: "Email",
  phone: "Teléfono",
  address: "Dirección",
  city: "Ciudad",
  province: "Provincia",
  postal_code: "Código Postal",
  coordinates: "Coordenadas",

  // Client fields
  type: "Tipo",
  IBAN: "IBAN",
  document_type: "Tipo de Documento",
  document_number: "Número de Documento",
  client_name: "Nombre del Cliente",
  client: "Cliente",
  client_type: "Tipo de Cliente",

  // Tramites fields
  creation_date: "Fecha de Creación",
  tramitation_date: "Fecha de Tramitación",
  activation_date: "Fecha de Activación",
  renovation_date: "Fecha de Renovación",
  collection_date: "Fecha de Cobro",
  payment_date: "Fecha de Pago",
  rejected_date: "Fecha de Rechazo",
  sales_name: "Nombre del Comercial",
  comision_sales_person: "Comisión Comercial",
  comision: "Comisión",
  status: "Estado",
  liquidez_status: "Estado de Liquidez",

  // Contracts fields
  old_company: "Comercializadora Anterior",
  new_company: "Nueva Comercializadora",
  plan: "Plan",
  consumption: "Consumo",
  CUPS: "CUPS",
  pot1: "Potencia P1",
  pot2: "Potencia P2",
  pot3: "Potencia P3",
  pot4: "Potencia P4",
  pot5: "Potencia P5",
  pot6: "Potencia P6",
  description: "Descripción",
  tramite_id: "ID Trámite",

  // User fields
  email_verified: "Email Verificado",
  image: "Imagen",
  created_at: "Creado en",
  role: "Rol",
  banned: "Bloqueado",
  ban_reason: "Razón de Bloqueo",
  ban_expires: "Expira Bloqueo",
  super_id: "ID Superior",
  should_reset_password: "Debe Resetear Contraseña",
  company: "Empresa",

  // Comparativas fields
  service: "Servicio",
  comision_fijo: "Comisión Fijo",
  comision_indexado: "Comisión Indexado",
  comision_sales_person_fijo: "Comisión Comercial Fijo",
  comision_sales_person_indexado: "Comisión Comercial Indexado",

  // Fotovoltaica fields
  location: "Ubicación",

  // Signers fields
  cargo: "Cargo",

  // Files fields
  filename: "Nombre del Archivo",
  size: "Tamaño",
  extension: "Extensión",
  upload_date: "Fecha de Subida",
  download_url: "URL de Descarga",
  preview_url: "URL de Vista Previa",
  comparativa_id: "ID Comparativa",
  fotovoltaica_id: "ID Fotovoltaica",

  // Additional common fields that might appear
  total: "Total",
  count: "Cantidad",
  amount: "Importe",
  percentage: "Porcentaje",
  date: "Fecha",
  time: "Hora",
  timestamp: "Marca de Tiempo",
  active: "Activo",
  inactive: "Inactivo",
  pending: "Pendiente",
  completed: "Completado",
  cancelled: "Cancelado",
  approved: "Aprobado",
  rejected: "Rechazado",
};

// Columns that should never be exported
const EXCLUDED_COLUMNS = [
  "user_id",
  "updated_by",
  "updated_at",
  "notes",
  "client_id",
  "internal_notes",
  "files",
];

// Function to translate column headers
const translateColumnHeader = (key: string): string => {
  // Return translation if exists, otherwise return the original key
  return COLUMN_TRANSLATIONS[key] || key;
};

interface ChatbotExportOptions {
  data: Record<string, unknown>[];
  filename: string;
  dataType:
    | "tramites"
    | "clients"
    | "comparativas"
    | "fotovoltaica"
    | "contracts"
    | "files"
    | "signers"
    | "general_data";
  query: string;
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

const processDataByType = (
  data: Record<string, unknown>[],
  dataType: ChatbotExportOptions["dataType"]
): Record<string, unknown>[] => {
  return data.map((row) => {
    const rowData: Record<string, unknown> = {}; // Process each field using the same logic as export.ts
    Object.keys(row).forEach((key) => {
      // Skip excluded columns
      if (EXCLUDED_COLUMNS.includes(key)) {
        return;
      }

      const value = row[key];
      const headerName = translateColumnHeader(key); // Translate column header      // Handle dates like export.ts
      if (
        key === "Fecha de Activación" ||
        key === "Fecha de Renovación" ||
        key === "Fecha de Creación" ||
        key === "creation_date" ||
        key === "activation_date" ||
        key === "renovation_date" ||
        key === "collection_date" ||
        key === "payment_date" ||
        key === "tramitation_date" ||
        key === "upload_date" ||
        key === "rejected_date" ||
        key === "created_at"
      ) {
        rowData[headerName] = value ? formatDate(String(value)) : "---";
      }
      // Handle user/commercial fields like export.ts
      else if (key === "Comercial" || key === "user" || key.includes("user")) {
        if (typeof value === "object" && value !== null) {
          const userObject = value as {
            name?: string;
            email?: string;
            image?: string;
          };
          rowData[headerName] =
            `${userObject.name || ""} (${userObject.email || ""})`.replace(
              " ()",
              ""
            );
        } else if (Array.isArray(value)) {
          rowData[headerName] = value.join(", ");
        } else {
          rowData[headerName] = value;
        }
      }
      // Handle status like export.ts
      else if (key === "Estado" || key === "status") {
        if (dataType === "comparativas") {
          rowData[headerName] = formatComparativaStatus(
            value as ComparativaStatus
          );
        } else {
          rowData[headerName] = value || "---";
        }
      } // Handle commission fields like export.ts
      else if (
        key === "Comisión" ||
        key === "Comisión Comercial" ||
        key === "comision" ||
        key === "comision_sales_person" ||
        key === "comision_fijo" ||
        key === "comision_indexado" ||
        key === "comision_sales_person_fijo" ||
        key === "comision_sales_person_indexado"
      ) {
        if (typeof value === "object" && value !== null) {
          const comisionObj = value as {
            fijo?: number;
            indexado?: number;
          };

          const fijoHeaderName =
            key.includes("sales_person") || key.includes("Comercial")
              ? "Comisión Comercial Fijo"
              : "Comisión Fijo";
          const indexadoHeaderName =
            key.includes("sales_person") || key.includes("Comercial")
              ? "Comisión Comercial Indexado"
              : "Comisión Indexado";

          rowData[fijoHeaderName] = comisionObj.fijo || 0;
          rowData[indexadoHeaderName] = comisionObj.indexado || 0;
        } else if (Array.isArray(value)) {
          rowData[headerName] = value.join(", ");
        } else {
          rowData[headerName] = Number(value || 0);
        }
      }
      // Handle arrays like export.ts
      else if (Array.isArray(value)) {
        rowData[headerName] = value.join(", ");
      }
      // Handle everything else
      else {
        rowData[headerName] = value ? value : "---";
      }
    });

    return rowData;
  });
};

export async function exportChatbotDataToExcel({
  data,
  filename,
  dataType,
  query,
}: ChatbotExportOptions): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data || data.length === 0) {
      return { success: false, error: "No hay datos para exportar" };
    }

    // Process data based on type
    const processedData = processDataByType(data, dataType);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(processedData);

    // Add metadata sheet with query information
    const metadataSheet = XLSX.utils.json_to_sheet([
      {
        "Consulta Original": query,
        "Tipo de Datos": dataType,
        "Fecha de Exportación": new Date().toLocaleString(),
        "Total de Registros": data.length,
      },
    ]);

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    XLSX.utils.book_append_sheet(workbook, metadataSheet, "Información");

    // Auto-adjust column widths
    const columnWidths = Object.keys(processedData[0]).map((key) => ({
      wch: Math.max(
        key.length,
        ...processedData.map((row) => String(row[key] || "").length)
      ),
    }));
    worksheet["!cols"] = columnWidths.map((width) => ({
      wch: Math.min(width.wch, 50), // Max width of 50
    }));

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    // Export file
    XLSX.writeFile(workbook, finalFilename);

    return { success: true };
  } catch (error) {
    console.error("Error exporting chatbot data to Excel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
