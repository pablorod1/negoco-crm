"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Calendar,
  User,
  Mail,
  Phone,
  MapPin,
  Download,
} from "lucide-react";
import { formatDate } from "@/lib/core/format";
import Link from "next/link";
import { ClientDB, User as UserType } from "@/lib/core/types";
import { exportChatbotDataToExcel } from "@/lib/core/chatbotExport";
import { showCustomToast } from "@/components/core/CustomToast";
import { useState } from "react";

// Extended interface for chatbot queries that may include tramite data
export interface ClientDataWithTramite extends ClientDB {
  // Last tramite fields that may come from SQL JOINs
  last_tramite_id?: string;
  last_tramite_date?: string;
  last_tramite_status?: string;
  last_tramite_sales?: string;
  last_tramite_comision?: number;
  // Alternative field names for compatibility with different SQL results
  tramite_id?: string;
  creation_date?: string;
  status?: string;
  sales_name?: string;
  comision?: number;
  client_name?: string; // For when name is concatenated in SQL
}

interface ChatbotClientsTableProps {
  data: ClientDataWithTramite[];
  query: string;
  userData?: UserType;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Activo":
      return "bg-green-100 text-green-800 border-green-200";
    case "Pendiente de Firma":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Procesando":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Verificado":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "Baja":
    case "Cancelado":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default function ChatbotClientsTable({
  data,
  query,
  userData,
}: ChatbotClientsTableProps) {
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
        filename: `clientes_busqueda`,
        dataType: "clients",
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
      <Card className="w-full max-w-2xl">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            No se encontraron clientes que coincidan con tu búsqueda.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if user can export (role !== "2")
  const canExport = userData && userData.role !== "2";

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Resultados de Clientes
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.length} cliente{data.length !== 1 ? "s" : ""} encontrado
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
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {data.map((client, index) => (
            <div
              key={`${client.id}-${index}`}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">
                    {client.client_name || `${client.name} ${client.last_name}`}
                  </h3>
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-800 border-blue-200"
                  >
                    {client.type}
                  </Badge>
                </div>
                <Link href={`/clientes/${client.id}`}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs">
                      {client.address}, {client.postal_code} {client.city},{" "}
                      {client.province}
                    </span>
                  </div>

                  <div className="text-xs">
                    <span className="text-muted-foreground">
                      {client.document_type}:{" "}
                    </span>
                    <span className="font-mono">{client.document_number}</span>
                  </div>
                </div>{" "}
                <div className="space-y-2">
                  {/* Last tramite info */}
                  {(client.last_tramite_id || client.tramite_id) && (
                    <div className="border-l-2 border-primary/20 pl-3">
                      <h4 className="font-medium text-sm mb-2">
                        Último Trámite
                      </h4>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {client.last_tramite_id || client.tramite_id}
                          </span>
                          {(client.last_tramite_status || client.status) && (
                            <Badge
                              variant="outline"
                              className={getStatusColor(
                                client.last_tramite_status ||
                                  client.status ||
                                  ""
                              )}
                            >
                              {client.last_tramite_status || client.status}
                            </Badge>
                          )}
                        </div>

                        {(client.last_tramite_date || client.creation_date) && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">
                              {formatDate(
                                client.last_tramite_date ||
                                  client.creation_date ||
                                  ""
                              )}
                            </span>
                          </div>
                        )}

                        {(client.last_tramite_sales || client.sales_name) && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">
                              Comercial:{" "}
                            </span>
                            <span className="font-medium">
                              {client.last_tramite_sales || client.sales_name}
                            </span>
                          </div>
                        )}

                        {(client.last_tramite_comision || client.comision) && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">
                              Comisión:{" "}
                            </span>
                            <span className="font-medium">
                              {(
                                client.last_tramite_comision || client.comision
                              )?.toFixed(2)}
                              €
                            </span>
                          </div>
                        )}

                        <Link
                          href={`/tramites/${client.last_tramite_id || client.tramite_id}`}
                        >
                          <Button variant="outline" size="sm" className="mt-2">
                            Ver Trámite
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* No tramites */}
                  {!client.last_tramite_id && !client.tramite_id && (
                    <div className="border-l-2 border-gray-200 pl-3">
                      <p className="text-sm text-muted-foreground">
                        Sin trámites registrados
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
