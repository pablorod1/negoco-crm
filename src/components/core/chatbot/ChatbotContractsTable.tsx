"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Calendar,
  FileText,
  MapPin,
  Download,
} from "lucide-react";
import { formatDate } from "@/lib/core/format";
import Link from "next/link";
import { ContractDB, User as UserType } from "@/lib/core/types";
import { exportChatbotDataToExcel } from "@/lib/core/chatbotExport";
import { showCustomToast } from "@/components/core/CustomToast";
import { useState } from "react";

// Extend ContractDB with extra properties needed for table display
interface ContractDataWithExtras extends ContractDB {
  client_name?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  status?: string;
  contracted_power?: number;
  estimated_consumption?: number;
  monthly_payment?: number;
  creation_date?: string;
  last_update?: string;
  observations?: string;
  tariff_type?: string;
  contract_type?: string;
  cups?: string;
  client_id?: string;
}

interface ChatbotContractsTableProps {
  data: ContractDataWithExtras[];
  query: string;
  userData?: UserType;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "activo":
      return "bg-green-100 text-green-800 border-green-200";
    case "pendiente":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "cancelado":
      return "bg-red-100 text-red-800 border-red-200";
    case "finalizado":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "suspendido":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getContractTypeColor = (type: string) => {
  switch (type?.toLowerCase()) {
    case "luz":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "gas":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "dual":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const formatPower = (power: number) => {
  return `${power.toFixed(2)} kW`;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export default function ChatbotContractsTable({
  data,
  query,
  userData,
}: ChatbotContractsTableProps) {
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
        filename: `contratos_busqueda`,
        dataType: "contracts",
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
            No se encontraron contratos que coincidan con tu búsqueda.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if user can export (role !== "2")
  const canExport = userData && userData.role !== "2";

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resultados de Contratos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.length} contrato{data.length !== 1 ? "s" : ""} encontrado
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
          {data.map((contrato) => (
            <Card key={contrato.id} className="border-l-4 border-l-purple-500">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-lg">
                      CUPS: {contrato.cups}
                    </h4>
                    {contrato.client_name && (
                      <p className="text-sm text-muted-foreground">
                        Cliente: {contrato.client_name}
                      </p>
                    )}
                    {contrato.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {contrato.address}
                        {contrato.city && `, ${contrato.city}`}
                        {contrato.province && ` (${contrato.province})`}
                        {contrato.postal_code && ` - ${contrato.postal_code}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {" "}
                    <Badge
                      variant="outline"
                      className={getContractTypeColor(
                        contrato.contract_type || contrato.type || ""
                      )}
                    >
                      {contrato.contract_type || contrato.type || "N/A"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getStatusColor(contrato.status || "")}
                    >
                      {contrato.status || "N/A"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Contract Information */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-muted-foreground">
                      INFORMACIÓN DEL CONTRATO
                    </h5>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Tipo de tarifa:</span>
                        <span className="font-medium">
                          {contrato.tariff_type}
                        </span>
                      </div>{" "}
                      <div className="flex justify-between text-sm">
                        <span>Potencia contratada:</span>
                        <span className="font-medium">
                          {contrato.contracted_power
                            ? formatPower(contrato.contracted_power)
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Consumo estimado:</span>
                        <span className="font-medium">
                          {contrato.estimated_consumption
                            ? contrato.estimated_consumption.toLocaleString()
                            : contrato.consumption
                              ? contrato.consumption.toLocaleString()
                              : "N/A"}{" "}
                          kWh/año
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Information */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-muted-foreground">
                      INFORMACIÓN FINANCIERA
                    </h5>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Pago mensual:</span>{" "}
                        <span className="font-medium">
                          {contrato.monthly_payment
                            ? formatCurrency(contrato.monthly_payment)
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contract Timeline */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-muted-foreground">
                      VIGENCIA DEL CONTRATO
                    </h5>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />{" "}
                        <span>
                          Inicio:{" "}
                          {contrato.contract_start_date
                            ? formatDate(contrato.contract_start_date)
                            : "N/A"}
                        </span>
                      </div>
                      {contrato.contract_end_date && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Fin: {formatDate(contrato.contract_end_date)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />{" "}
                        <span>
                          Actualizado:{" "}
                          {contrato.last_update
                            ? formatDate(contrato.last_update)
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observations */}
                {contrato.observations && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-medium text-sm text-muted-foreground mb-2">
                      OBSERVACIONES
                    </h5>
                    <p className="text-sm">{contrato.observations}</p>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/contratos/${contrato.id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver contrato
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
