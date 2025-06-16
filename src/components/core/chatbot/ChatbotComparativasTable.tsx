"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Calendar,
  Building,
  User as UserIcon,
  Euro,
  Download,
} from "lucide-react";
import { formatDate } from "@/lib/core/format";
import Link from "next/link";
import { ComparativaStatus, ComparativaVM, User } from "@/lib/core/types";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import { exportChatbotDataToExcel } from "@/lib/core/chatbotExport";
import { showCustomToast } from "@/components/core/CustomToast";
import { useState } from "react";

interface ChatbotComparativasTableProps {
  data: ComparativaVM[];
  query: string;
  userData: User;
}

const getServiceColor = (service: string) => {
  switch (service?.toLowerCase()) {
    case "luz":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "gas":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default function ChatbotComparativasTable({
  data,
  query,
  userData,
}: ChatbotComparativasTableProps) {
  const [isExporting, setIsExporting] = useState(false);
  const isComercial = userData.role === "2";

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
        filename: `comparativas_busqueda`,
        dataType: "comparativas",
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Comparativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No se encontraron comparativas que coincidan con tu búsqueda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Resultados de Comparativas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.length} comparativa{data.length !== 1 ? "s" : ""} encontrada
              {data.length !== 1 ? "s" : ""} para: &ldquo;{query}&rdquo;
            </p>
          </div>
          {!isComercial && (
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
          {data.map((comparativa) => (
            <Card key={comparativa.id} className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-lg">
                      {comparativa.client}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {comparativa.plan}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={getServiceColor(comparativa.service)}
                    >
                      {comparativa.service}
                    </Badge>
                    {getStatusBadge(comparativa.status as ComparativaStatus)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {" "}
                  {/* Commission Information */}
                  {!isComercial ? (
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                        <Euro className="h-4 w-4" />
                        COMISIONES
                      </h5>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Fijo:</span>
                          <span className="font-medium">
                            {comparativa.comision?.fijo
                              ? comparativa.comision.fijo.toFixed(2)
                              : 0}{" "}
                            €
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Indexado:</span>
                          <span className="font-medium">
                            {comparativa.comision?.indexado
                              ? comparativa.comision.indexado.toFixed(2)
                              : 0}{" "}
                            €
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}{" "}
                  {/* Sales Commission */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      {isComercial ? "COMISIONES" : "COMISIONES COMERCIAL"}
                    </h5>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Fijo:</span>
                        <span className="font-medium">
                          {comparativa.comision_sales_person?.fijo
                            ? comparativa.comision_sales_person.fijo.toFixed(2)
                            : 0}{" "}
                          €
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Indexado:</span>
                        <span className="font-medium">
                          {comparativa.comision_sales_person?.indexado
                            ? comparativa.comision_sales_person.indexado.toFixed(
                                2
                              )
                            : 0}{" "}
                          €
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Additional Info */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      INFORMACIÓN
                    </h5>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Creado:</span>
                        <span className="ml-1 font-medium">
                          {formatDate(comparativa.creation_date)}
                        </span>
                      </div>
                      {comparativa.user?.name && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Comercial:
                          </span>
                          <span className="ml-1 font-medium">
                            {comparativa.user.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {comparativa.notes && comparativa.notes.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-medium text-sm text-muted-foreground mb-2">
                      NOTAS
                    </h5>
                    <div className="space-y-1">
                      {comparativa.notes.map((note, index) => (
                        <p key={index} className="text-sm">
                          {note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/comparativas/${comparativa.id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver detalles
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
