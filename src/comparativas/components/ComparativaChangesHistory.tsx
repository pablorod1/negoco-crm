"use client";

import React, { useEffect, useState } from "react";
import { ComparativaChange } from "@/comparativas/utils/comparativaChangesHelpers";
import { User } from "@/core/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Badge } from "@/core/components/ui/badge";
import { Avatar, AvatarFallback } from "@/core/components/ui/avatar";
import {
  History,
  User as UserIcon,
  FileText,
  Edit,
  Plus,
  RefreshCw,
  Settings,
  CreditCard,
  Building,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/core/utils";
import { formatDateTime } from "@/core/utils/format";

interface Props {
  comparativaId: string;
  userData?: User;
}

interface GroupedChange {
  id: string;
  date: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  changes: ComparativaChange[];
}

export default function ComparativaChangesHistory({ comparativaId }: Props) {
  const [changes, setChanges] = useState<ComparativaChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChanges = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/v2/comparisons/${comparativaId}/changes`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Error al cargar el historial de cambios");
        }

        const { success, data } = await response.json();
        if (success && data) {
          setChanges(data);
        } else {
          setError("No se pudieron cargar los cambios");
        }
      } catch (err) {
        console.error("Error fetching changes:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchChanges();
  }, [comparativaId]);

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case "created":
        return <Plus className="h-4 w-4" />;
      case "status_change":
        return <RefreshCw className="h-4 w-4" />;
      case "field_update":
        return <Edit className="h-4 w-4" />;
      case "client_update":
        return <UserIcon className="h-4 w-4" />;
      case "document_upload":
      case "document_delete":
        return <FileText className="h-4 w-4" />;
      case "note_added":
      case "note_deleted":
        return <FileText className="h-4 w-4" />;
      case "assignment_change":
        return <UserIcon className="h-4 w-4" />;
      case "commission_update":
        return <CreditCard className="h-4 w-4" />;
      case "service_update":
        return <Building className="h-4 w-4" />;
      case "plan_update":
        return <Settings className="h-4 w-4" />;
      case "converted_to_contract":
        return <RefreshCw className="h-4 w-4" />;
      case "general_update":
        return <Edit className="h-4 w-4" />;
      case "deleted":
        return <FileText className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case "created":
        return "bg-green-100 text-green-700 border-green-200";
      case "status_change":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "field_update":
      case "general_update":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "client_update":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "document_upload":
        return "bg-green-100 text-green-700 border-green-200";
      case "document_delete":
      case "note_deleted":
      case "deleted":
        return "bg-red-100 text-red-700 border-red-200";
      case "note_added":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "assignment_change":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "commission_update":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "service_update":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "plan_update":
        return "bg-teal-100 text-teal-700 border-teal-200";
      case "converted_to_contract":
        return "bg-sky-100 text-sky-700 border-sky-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatChangeType = (changeType: string) => {
    const typeMap: Record<string, string> = {
      created: "Creación",
      status_change: "Cambio de Estado",
      field_update: "Actualización",
      general_update: "Actualización General",
      client_update: "Cliente",
      document_upload: "Documento Subido",
      document_delete: "Documento Eliminado",
      note_added: "Nota Agregada",
      note_deleted: "Nota Eliminada",
      assignment_change: "Asignación",
      commission_update: "Comisión",
      service_update: "Servicio",
      plan_update: "Plan",
      converted_to_contract: "Conversión a Contrato",
      deleted: "Eliminación",
    };
    return typeMap[changeType] || changeType;
  };

  const formatFieldName = (fieldName: string | null): string => {
    if (!fieldName) return "";

    // Handle comparativa fields
    const comparativaFieldMap: Record<string, string> = {
      status: "Estado de la Comparativa",
      user_id: "Comercial Asignado",
      client: "Cliente",
      service: "Servicio",
      plan: "Plan",
      comision_fijo: "Comisión Fija",
      comision_indexado: "Comisión Indexada",
      comision_sales_person_fijo: "Comisión Comercial Fija",
      comision_sales_person_indexado: "Comisión Comercial Indexada",
      creation_date: "Fecha de Creación",
      notes: "Notas",
      documents: "Documentos",
      filename: "Archivo",
      note: "Nota",
      tramite_id: "Trámite Convertido",
    };

    return comparativaFieldMap[fieldName] || fieldName;
  };

  const groupChangesByDateAndUser = (
    changes: ComparativaChange[]
  ): GroupedChange[] => {
    const groups: Record<string, GroupedChange> = {};

    changes.forEach((change) => {
      const date = new Date(change.created_at).toDateString();
      const userId = change.user_id || "system";
      const groupKey = `${date}-${userId}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          date: change.created_at,
          user: {
            id: userId,
            name: change.user_name || "Sistema",
          },
          changes: [],
        };
      }

      groups[groupKey].changes.push(change);
    });

    // Sort groups by date (most recent first) and sort changes within each group
    return Object.values(groups)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((group) => ({
        ...group,
        changes: group.changes.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando historial de cambios...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedChanges = groupChangesByDateAndUser(changes);

  if (groupedChanges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-gray-800 text-lg font-semibold">
            <History className="h-5 w-5 text-gray-600" />
            Historial de Cambios
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-gray-500">
            <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No hay cambios registrados para esta comparativa</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-gray-800 text-lg font-semibold">
          <History className="h-5 w-5 text-gray-600" />
          Historial de Cambios
          <Badge variant="secondary" className="ml-auto">
            {changes.length} cambio{changes.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-6">
          {groupedChanges.map((group, groupIndex) => {
            const isLast = groupIndex === groupedChanges.length - 1;

            return (
              <div key={group.id} className="relative">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-6 top-16 w-0.5 h-full bg-gray-200 z-0" />
                )}

                {/* Group header */}
                <div className="relative flex items-center gap-4 mb-4">
                  <Avatar className="w-12 h-12 border-2 border-white shadow-sm z-10">
                    <AvatarFallback className="bg-gray-100 text-gray-600">
                      {group.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {group.user.name}
                      </h3>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-500">
                        {formatDateTime(group.date)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {group.changes.length} cambio
                      {group.changes.length !== 1 ? "s" : ""} realizado
                      {group.changes.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Changes in this group */}
                <div className="ml-16 space-y-3">
                  {group.changes.map((change, changeIndex) => (
                    <div
                      key={`${change.id}-${changeIndex}`}
                      className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow duration-200"
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full border",
                          getChangeColor(change.change_type)
                        )}
                      >
                        {getChangeIcon(change.change_type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              getChangeColor(change.change_type)
                            )}
                          >
                            {formatChangeType(change.change_type)}
                          </Badge>
                          {change.field_name && (
                            <span className="text-xs text-gray-500">
                              • {formatFieldName(change.field_name)}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-900 font-medium mb-1">
                          {change.description}
                        </p>

                        {/* Show old/new values for changes */}
                        {(change.old_value || change.new_value) && (
                          <div className="text-xs text-gray-600 space-y-1">
                            {change.old_value && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">Anterior:</span>
                                <code className="bg-red-50 text-red-700 px-2 py-1 rounded border">
                                  {change.old_value}
                                </code>
                              </div>
                            )}
                            {change.new_value && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">Nuevo:</span>
                                <code className="bg-green-50 text-green-700 px-2 py-1 rounded border">
                                  {change.new_value}
                                </code>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-400">
                        {new Date(change.created_at).toLocaleTimeString(
                          "es-ES",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
