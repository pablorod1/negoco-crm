"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Calendar,
  User,
  Building2,
  Euro,
  Download,
} from "lucide-react";
import { formatDate } from "@/lib/core/format";
import Link from "next/link";
import { TramiteDB, User as UserType } from "@/lib/core/types";
import { exportChatbotDataToExcel } from "@/lib/core/chatbotExport";
import { showCustomToast } from "@/components/core/CustomToast";
import { useState } from "react";

// Extended interface for chatbot queries that may include client and contract data
export interface TramiteDataWithExtras extends TramiteDB {
  // Client fields from JOINs
  client_name?: string;
  client_email?: string;
  // Contract fields from JOINs
  new_company?: string;
  old_company?: string;
  plan?: string;
  contract_type?: string;
  CUPS?: string;
}

interface ChatbotTramitesTableProps {
  data: TramiteDataWithExtras[];
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
    case "Pendiente de Cobro":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "Cobrado":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default function ChatbotTramitesTable({
  data,
  query,
  userData,
}: ChatbotTramitesTableProps) {
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
        filename: `tramites_busqueda`,
        dataType: "tramites",
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
            No se encontraron trámites que coincidan con tu búsqueda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Resultados de Trámites
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.length} trámite{data.length !== 1 ? "s" : ""} encontrado
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
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {data.map((tramite) => (
            <div
              key={tramite.id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {tramite.id}
                  </span>
                  <Badge
                    variant="outline"
                    className={getStatusColor(tramite.status)}
                  >
                    {tramite.status}
                  </Badge>
                  {tramite.liquidez_status && (
                    <Badge
                      variant="outline"
                      className={getStatusColor(tramite.liquidez_status)}
                    >
                      {tramite.liquidez_status}
                    </Badge>
                  )}
                </div>
                <Link href={`/tramites/${tramite.id}`}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  {tramite.client_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{tramite.client_name}</span>
                      {tramite.client_email && (
                        <span className="text-muted-foreground">
                          ({tramite.client_email})
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Creación: {formatDate(tramite.creation_date)}</span>
                  </div>

                  {tramite.activation_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Activación: {formatDate(tramite.activation_date)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Comercial: {tramite.sales_name}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {tramite.new_company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {tramite.old_company && (
                          <span className="text-muted-foreground">
                            {tramite.old_company} →{" "}
                          </span>
                        )}
                        <span className="font-medium">
                          {tramite.new_company}
                        </span>
                      </span>
                    </div>
                  )}

                  {tramite.plan && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Plan: </span>
                      <span className="font-medium">{tramite.plan}</span>
                    </div>
                  )}

                  {tramite.contract_type && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Tipo: </span>
                      <span className="font-medium">
                        {tramite.contract_type}
                      </span>
                    </div>
                  )}

                  {(tramite.comision || tramite.comision_sales_person) && (
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {tramite.comision_sales_person && (
                          <span className="font-medium">
                            {tramite.comision_sales_person}€
                          </span>
                        )}
                        {tramite.comision &&
                        tramite.comision_sales_person &&
                        !isComercial ? (
                          <span className="text-muted-foreground"> / </span>
                        ) : null}
                        {tramite.comision && !isComercial ? (
                          <span className="text-muted-foreground">
                            {tramite.comision}€ total
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}

                  {tramite.CUPS && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">CUPS: </span>
                      <span className="font-mono text-xs">{tramite.CUPS}</span>
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
