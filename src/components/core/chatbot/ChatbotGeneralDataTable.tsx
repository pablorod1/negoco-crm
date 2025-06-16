"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/core/format";
import { User as UserType } from "@/lib/core/types";
import { exportChatbotDataToExcel } from "@/lib/core/chatbotExport";
import { showCustomToast } from "@/components/core/CustomToast";
import { useState } from "react";

export interface GeneralData {
  [key: string]: unknown;
}

interface ChatbotGeneralDataTableProps {
  data: GeneralData[];
  query: string;
  userData?: UserType;
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (typeof value === "number") {
    // Try to format as currency if it looks like a monetary value
    if (
      value > 0 &&
      value < 1000000 &&
      (value.toString().includes(".") || value % 1 === 0)
    ) {
      return new Intl.NumberFormat("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return value.toLocaleString("es-ES");
  }

  if (typeof value === "string") {
    // Try to format as date if it looks like a date
    if (
      value.match(/^\d{4}-\d{2}-\d{2}/) ||
      value.match(/^\d{2}\/\d{2}\/\d{4}/)
    ) {
      try {
        return formatDate(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

const getFieldDisplayName = (fieldName: string): string => {
  const fieldMappings: Record<string, string> = {
    // Common fields
    id: "ID",
    name: "Nombre",
    email: "Email",
    phone: "Teléfono",
    address: "Dirección",
    city: "Ciudad",
    province: "Provincia",
    postal_code: "Código Postal",
    creation_date: "Fecha de Creación",
    last_update: "Última Actualización",
    status: "Estado",

    // Client fields
    client_id: "ID Cliente",
    client_name: "Nombre Cliente",
    document_number: "Número Documento",
    document_type: "Tipo Documento",
    last_name: "Apellidos",

    // Tramite fields
    tramite_id: "ID Trámite",
    tramite_type: "Tipo Trámite",
    sales_name: "Comercial",
    comision: "Comisión",

    // Contract fields
    cups: "CUPS",
    contract_type: "Tipo Contrato",
    tariff_type: "Tipo Tarifa",
    contracted_power: "Potencia Contratada",
    estimated_consumption: "Consumo Estimado",
    monthly_payment: "Pago Mensual",

    // Comparativa fields
    company_name: "Compañía",
    tariff_name: "Nombre Tarifa",
    price_energy: "Precio Energía",
    price_power: "Precio Potencia",

    // Fotovoltaica fields
    project_name: "Nombre Proyecto",
    installation_power: "Potencia Instalación",
    annual_generation: "Generación Anual",
    investment_amount: "Inversión",

    // User fields
    role: "Rol",
    avatar_url: "Avatar",

    // File fields
    file_name: "Nombre Archivo",
    file_size: "Tamaño Archivo",
    file_type: "Tipo Archivo",
  };

  return (
    fieldMappings[fieldName] ||
    fieldName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
};

const isImportantField = (fieldName: string): boolean => {
  const importantFields = [
    "id",
    "name",
    "client_name",
    "tramite_id",
    "cups",
    "project_name",
    "company_name",
    "tariff_name",
    "status",
    "email",
    "phone",
  ];
  return importantFields.includes(fieldName);
};

export default function ChatbotGeneralDataTable({
  data,
  query,
  userData,
}: ChatbotGeneralDataTableProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!data || data.length === 0) {
      showCustomToast({
        title: "Error",
        message: "No hay datos para exportar",
        icon: Download,
        iconColor: "var(--danger-color)",
      });
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportChatbotDataToExcel({
        data: data as unknown as Record<string, unknown>[],
        filename: `datos_busqueda`,
        dataType: "general_data",
        query,
      });

      if (result.success) {
        showCustomToast({
          title: "Exportación exitosa",
          message: "Los datos se han exportado correctamente",
          icon: Download,
          iconColor: "var(--success-color)",
        });
      } else {
        throw new Error(result.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      showCustomToast({
        title: "Error en la exportación",
        message: error instanceof Error ? error.message : "Error desconocido",
        icon: Download,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!data || data.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            No se encontraron datos que coincidan con tu búsqueda.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if user can export (role !== "2")
  const canExport = userData && userData.role !== "2";

  // Get all unique field names from the data
  const allFields = Array.from(
    new Set(data.flatMap((item) => Object.keys(item)))
  );

  // Separate important fields from others
  const importantFields = allFields.filter(isImportantField);
  const otherFields = allFields.filter((field) => !isImportantField(field));

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Resultados de Datos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.length} registro{data.length !== 1 ? "s" : ""} encontrado
              {data.length !== 1 ? "s" : ""} para: &ldquo;{query}&rdquo;
            </p>
          </div>
          {canExport && (
            <Button
              onClick={handleExport}
              disabled={isExporting}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <Card key={index} className="border-l-4 border-l-gray-500">
              <CardContent className="pt-4">
                {/* Important fields first */}
                {importantFields.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {importantFields.map(
                        (field) =>
                          item[field] !== undefined && (
                            <div key={field} className="space-y-1">
                              <div className="flex justify-between items-start">
                                <span className="text-sm font-medium text-muted-foreground">
                                  {getFieldDisplayName(field)}:
                                </span>
                                <span className="text-sm font-medium text-right">
                                  {formatValue(item[field])}
                                </span>
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  </div>
                )}

                {/* Other fields */}
                {otherFields.length > 0 && (
                  <div className="pt-4 border-t">
                    <h5 className="font-medium text-sm text-muted-foreground mb-3">
                      INFORMACIÓN ADICIONAL
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {otherFields.map(
                        (field) =>
                          item[field] !== undefined &&
                          item[field] !== null && (
                            <div key={field} className="space-y-1">
                              <div className="flex justify-between items-start">
                                <span className="text-xs text-muted-foreground">
                                  {getFieldDisplayName(field)}:
                                </span>
                                <span className="text-xs text-right max-w-[60%] break-words">
                                  {formatValue(item[field])}
                                </span>
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary information */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Consulta ejecutada con {data.length} resultado
              {data.length !== 1 ? "s" : ""} encontrado
              {data.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Campos disponibles: {allFields.join(", ")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
