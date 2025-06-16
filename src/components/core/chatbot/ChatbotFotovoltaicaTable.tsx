"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Calendar,
  Zap,
  MapPin,
  Building,
  Download,
} from "lucide-react";
import { formatDate } from "@/lib/core/format";
import Link from "next/link";
import { FotovoltaicaVM, User as UserType } from "@/lib/core/types";
import { exportChatbotDataToExcel } from "@/lib/core/chatbotExport";
import { showCustomToast } from "@/components/core/CustomToast";
import { useState } from "react";

interface ChatbotFotovoltaicaTableProps {
  data: FotovoltaicaVM[];
  query: string;
  userData?: UserType;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-800 border-green-200";
    case "processing":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getTypeColor = (type: string) => {
  switch (type?.toLowerCase()) {
    case "ppa":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "renting":
      return "bg-green-100 text-green-800 border-green-200";
    case "cubierta":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getClientTypeColor = (clientType: string) => {
  switch (clientType?.toLowerCase()) {
    case "company":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "public_org":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "community":
      return "bg-teal-100 text-teal-800 border-teal-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default function ChatbotFotovoltaicaTable({
  data,
  query,
  userData,
}: ChatbotFotovoltaicaTableProps) {
  const [isExporting, setIsExporting] = useState(false);
  const isComercial = userData && userData.role === "2";

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
        filename: `fotovoltaica_busqueda`,
        dataType: "fotovoltaica",
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
            No se encontraron proyectos fotovoltaicos que coincidan con tu
            búsqueda.
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
              <Zap className="h-5 w-5" />
              Resultados de Fotovoltaica
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.length} proyecto{data.length !== 1 ? "s" : ""} encontrado
              {data.length !== 1 ? "s" : ""} para: &ldquo;{query}&rdquo;
            </p>
          </div>
          {!isComercial ? (
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
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((proyecto) => (
            <Card key={proyecto.id} className="border-l-4 border-l-yellow-500">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-lg">{proyecto.id}</h4>
                    {proyecto.client && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {proyecto.client}
                      </p>
                    )}
                    {proyecto.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {proyecto.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={getTypeColor(proyecto.type)}
                    >
                      {proyecto.type || "N/A"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getStatusColor(proyecto.status)}
                    >
                      {proyecto.status?.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Project Information */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-muted-foreground">
                      INFORMACIÓN DEL PROYECTO
                    </h5>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Tipo de cliente:</span>
                        <Badge
                          variant="outline"
                          className={getClientTypeColor(proyecto.client_type)}
                        >
                          {proyecto.client_type}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Financial Information */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-muted-foreground">
                      INFORMACIÓN FINANCIERA
                    </h5>
                    <div className="space-y-1">
                      {!isComercial ? (
                        <div className="flex justify-between text-sm">
                          <span>Comisión:</span>
                          <span className="font-medium">
                            {proyecto.comision}€
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-sm">
                        <span>
                          {isComercial ? "Comisión" : "Comisión Comercial"}
                        </span>
                        <span className="font-medium">
                          {proyecto.comision_sales_person}€
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-muted-foreground">
                      CRONOLOGÍA
                    </h5>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Creación: {formatDate(proyecto.creation_date)}
                        </span>
                      </div>
                      {proyecto.activation_date && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Activación: {formatDate(proyecto.activation_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {proyecto.notes && proyecto.notes.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-medium text-sm text-muted-foreground mb-2">
                      NOTAS
                    </h5>
                    <div className="space-y-1">
                      {proyecto.notes.map((note, index) => (
                        <p key={index} className="text-sm">
                          • {note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Internal Notes */}
                {proyecto.internal_notes &&
                  proyecto.internal_notes.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h5 className="font-medium text-sm text-muted-foreground mb-2">
                        NOTAS INTERNAS
                      </h5>
                      <div className="space-y-1">
                        {proyecto.internal_notes.map((note, index) => (
                          <p key={index} className="text-sm">
                            • {note}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Commercial information */}
                {proyecto.user?.name && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-medium text-sm text-muted-foreground mb-2">
                      COMERCIAL ASIGNADO
                    </h5>
                    <p className="text-sm">{proyecto.user.name}</p>
                  </div>
                )}

                {/* Action Button */}
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/fotovoltaica/${proyecto.id}`}>
                      Ver Detalles
                      <ExternalLink className="ml-2 h-4 w-4" />
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
