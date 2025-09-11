"use client";

import React, { useEffect, useState } from "react";
import { TramiteChangeWithUser } from "@/tramites/types/tramite-changes.types";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import {
  History,
  User as UserIcon,
  FileText,
  Edit,
  Plus,
  RefreshCw,
  Settings,
  CreditCard,
  Calendar,
  Building,
  UserCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/core/utils";
import { formatDateTime } from "@/core/utils/format";

interface Props {
  tramiteId: string;
  userData: User;
}

interface GroupedChange {
  id: string;
  date: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  changes: TramiteChangeWithUser[];
}

export default function TramiteChangesHistory({ tramiteId, userData }: Props) {
  const [changes, setChanges] = useState<TramiteChangeWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChanges = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/v2/contracts/${tramiteId}/changes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userData.id,
            role: userData.role,
            limit: 100,
          }),
        });

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
  }, [tramiteId, userData.id, userData.role]);

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
      case "signer_update":
        return <UserCheck className="h-4 w-4" />;
      case "document_upload":
      case "document_delete":
        return <FileText className="h-4 w-4" />;
      case "note_added":
        return <FileText className="h-4 w-4" />;
      case "assignment_change":
        return <UserIcon className="h-4 w-4" />;
      case "contract_created":
      case "contract_updated":
      case "contract_deleted":
        return <FileText className="h-4 w-4" />;
      case "commission_update":
        return <CreditCard className="h-4 w-4" />;
      case "date_update":
        return <Calendar className="h-4 w-4" />;
      case "provider_update":
        return <Building className="h-4 w-4" />;
      case "renewal_created":
      case "renewal_updated":
        return <RefreshCw className="h-4 w-4" />;
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
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "client_update":
      case "signer_update":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "document_upload":
        return "bg-green-100 text-green-700 border-green-200";
      case "document_delete":
        return "bg-red-100 text-red-700 border-red-200";
      case "note_added":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "assignment_change":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "contract_created":
      case "contract_updated":
        return "bg-cyan-100 text-cyan-700 border-cyan-200";
      case "contract_deleted":
        return "bg-red-100 text-red-700 border-red-200";
      case "commission_update":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "date_update":
        return "bg-teal-100 text-teal-700 border-teal-200";
      case "provider_update":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "renewal_created":
      case "renewal_updated":
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
      client_update: "Cliente",
      signer_update: "Firmante",
      document_upload: "Documento Subido",
      document_delete: "Documento Eliminado",
      note_added: "Nota",
      assignment_change: "Asignación",
      contract_created: "Contrato Creado",
      contract_updated: "Contrato Actualizado",
      contract_deleted: "Contrato Eliminado",
      commission_update: "Comisión",
      date_update: "Fecha",
      provider_update: "Proveedor",
      renewal_created: "Renovación Creada",
      renewal_updated: "Renovación",
    };
    return typeMap[changeType] || changeType;
  };

  const formatFieldName = (fieldName: string | null): string => {
    if (!fieldName) return "";

    // Handle contract fields
    if (fieldName.startsWith("contract.")) {
      const contractField = fieldName.replace("contract.", "");
      const contractFieldMap: Record<string, string> = {
        type: "Tipo de Contrato",
        province: "Provincia",
        city: "Ciudad",
        address: "Dirección",
        postal_code: "Código Postal",
        old_company: "Comercializadora Anterior",
        new_company: "Nueva Comercializadora",
        plan: "Plan Tarifario",
        consumption: "Consumo Anual (kWh)",
        CUPS: "Código CUPS",
        pot1: "Potencia P1 (kW)",
        pot2: "Potencia P2 (kW)",
        pot3: "Potencia P3 (kW)",
        pot4: "Potencia P4 (kW)",
        pot5: "Potencia P5 (kW)",
        pot6: "Potencia P6 (kW)",
        description: "Descripción del Contrato",
      };
      return contractFieldMap[contractField] || contractField;
    }

    // Handle client fields
    if (fieldName.startsWith("client.")) {
      const clientField = fieldName.replace("client.", "");
      const clientFieldMap: Record<string, string> = {
        name: "Nombre",
        last_name: "Apellidos",
        email: "Email",
        type: "Tipo de Cliente",
        phone: "Teléfono",
        address: "Dirección",
        postal_code: "Código Postal",
        province: "Provincia",
        city: "Ciudad",
        document_type: "Tipo de Documento",
        document_number: "Número de Documento",
        IBAN: "IBAN",
        coordinates: "Coordenadas",
      };
      return clientFieldMap[clientField] || clientField;
    }

    // Handle signer fields
    if (fieldName.startsWith("signer.")) {
      const signerField = fieldName.replace("signer.", "");
      const signerFieldMap: Record<string, string> = {
        name: "Nombre del Firmante",
        last_name: "Apellidos del Firmante",
        email: "Email del Firmante",
        phone: "Teléfono del Firmante",
        document_number: "Documento del Firmante",
        cargo: "Cargo del Firmante",
      };
      return signerFieldMap[signerField] || signerField;
    }

    // Handle tramite fields
    const tramiteFieldMap: Record<string, string> = {
      status: "Estado del Trámite",
      liquidez_status: "Estado de Liquidez",
      user_id: "Comercial Asignado",
      sales_name: "Nombre del Comercial",
      comision_sales_person: "Comisión del Comercial",
      comision: "Comisión Total",
      creation_date: "Fecha de Creación",
      tramitation_date: "Fecha de Tramitación",
      activation_date: "Fecha de Activación",
      renovation_date: "Fecha de Renovación",
      collection_date: "Fecha de Cobro",
      payment_date: "Fecha de Pago",
      rejected_date: "Fecha de Baja",
      provider: "Proveedor",
      notes: "Notas Públicas",
      internal_notes: "Notas Internas",
      documents: "Documentos",
      contracts: "Contratos",
      contract: "Contrato",
      client_id: "Cliente",
    };

    return tramiteFieldMap[fieldName] || fieldName;
  };

  const groupChangesByDateAndUser = (
    changes: TramiteChangeWithUser[]
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

  // Check if changes are contract field updates that should be grouped
  const isContractFieldUpdate = (change: TramiteChangeWithUser): boolean => {
    return (
      change.change_type === "contract_updated" &&
      (change.field_name?.startsWith("contract.") ?? false)
    );
  };

  // Group contract field updates together
  const groupContractUpdates = (
    changes: TramiteChangeWithUser[]
  ): TramiteChangeWithUser[] => {
    const contractUpdates = changes.filter(isContractFieldUpdate);
    const otherChanges = changes.filter(
      (change) => !isContractFieldUpdate(change)
    );

    if (contractUpdates.length <= 1) {
      return changes; // No grouping needed
    }

    // Create a single grouped change for contract updates
    const firstUpdate = contractUpdates[0];

    // Generate list of updated field names
    const updatedFields = contractUpdates
      .map((change) => formatFieldName(change.field_name || ""))
      .filter((fieldName) => fieldName !== "");

    // Create description based on number of fields
    let description: string;
    if (updatedFields.length <= 3) {
      description = `Actualización de contrato: ${updatedFields.join(", ")}`;
    } else {
      description = `Actualización de contrato: ${updatedFields.slice(0, 2).join(", ")} y ${updatedFields.length - 2} campos más`;
    }

    const groupedChange: TramiteChangeWithUser = {
      ...firstUpdate,
      id: `contract-group-${firstUpdate.id}`,
      description,
      field_name: "contract",
      old_value: null,
      new_value: null,
    };

    // Add the grouped change at the position of the first contract update
    const result = [...otherChanges];
    const insertIndex = changes.findIndex(
      (change) => change.id === firstUpdate.id
    );
    result.splice(insertIndex, 0, groupedChange);

    return result;
  };

  // Render contract updates table
  const renderContractUpdatesTable = (
    changes: TramiteChangeWithUser[]
  ): React.ReactNode => {
    const contractUpdates = changes.filter(isContractFieldUpdate);

    if (contractUpdates.length === 0) return null;

    return (
      <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-medium">Campo</TableHead>
              <TableHead className="text-xs font-medium">
                Valor Anterior
              </TableHead>
              <TableHead className="text-xs font-medium">Valor Nuevo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contractUpdates.map((change, index) => {
              const formattedFieldName = formatFieldName(
                change.field_name || ""
              );
              return (
                <TableRow key={`contract-${index}`} className="text-xs">
                  <TableCell className="font-medium py-2 px-3">
                    {formattedFieldName}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    {change.old_value ? (
                      <code className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs">
                        {change.old_value}
                      </code>
                    ) : (
                      <span className="text-gray-400 italic">vacío</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    {change.new_value ? (
                      <code className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                        {change.new_value}
                      </code>
                    ) : (
                      <span className="text-gray-400 italic">vacío</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="border-gray-200 shadow-sm">
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
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedChanges = groupChangesByDateAndUser(changes).map((group) => ({
    ...group,
    changes: groupContractUpdates(group.changes),
  }));

  if (groupedChanges.length === 0) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-gray-800 text-lg font-semibold">
            <History className="h-5 w-5 text-gray-600" />
            Historial de Cambios
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-gray-500">
            <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No hay cambios registrados para este trámite</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm">
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

                        {/* Show table for grouped contract updates */}
                        {change.field_name === "contract" &&
                        change.id?.startsWith("contract-group-")
                          ? renderContractUpdatesTable(group.changes)
                          : /* Show regular old/new values for other changes */
                            (change.old_value || change.new_value) && (
                              <div className="text-xs text-gray-600 space-y-1">
                                {change.old_value && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400">
                                      Anterior:
                                    </span>
                                    <code className="bg-red-50 text-red-700 px-2 py-1 rounded border">
                                      {change.old_value}
                                    </code>
                                  </div>
                                )}
                                {change.new_value && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400">
                                      Nuevo:
                                    </span>
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
