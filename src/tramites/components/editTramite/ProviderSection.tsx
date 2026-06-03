"use client";

import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { TramiteVM } from "@/tramites/types";
import { CircleCheck, CircleX, Pencil } from "lucide-react";
import { useState } from "react";
import { InputComponent } from "../createTramite/InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";

interface Props {
  tramite: TramiteVM;
  onUpdate?: () => void;
}
export default function ProviderSection({ tramite, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [newProvider, setNewProvider] = useState(tramite.provider || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = () => {
    if (isEditing) {
      // Reset to original value when canceling
      setNewProvider(tramite.provider || "");
    }
    setIsEditing(!isEditing);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewProvider(e.target.value);
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    // Normalize values for comparison (null/undefined becomes empty string)
    const currentProvider = tramite.provider || "";
    const newProviderTrimmed = newProvider.trim();

    if (newProviderTrimmed === currentProvider) {
      setIsEditing(false);
      setNewProvider(tramite.provider || "");
      showCustomToast({
        title: "No se han realizado cambios",
        message: "El proveedor es el mismo que el actual.",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--warning-color)",
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/v2/contracts/${tramite.id}/provider`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: newProviderTrimmed,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the local state to reflect the change
        setIsEditing(false);
        // Trigger parent component update to refresh data
        onUpdate?.();

        const isClearing = newProviderTrimmed === "";
        showCustomToast({
          title: isClearing ? "Proveedor eliminado" : "Proveedor actualizado",
          message: isClearing
            ? "El proveedor ha sido eliminado correctamente."
            : "El proveedor ha sido actualizado correctamente.",
          icon: CircleCheck,
          iconSize: 24,
          iconColor: "var(--success-color)",
        });
      } else {
        showCustomToast({
          title: "Error al actualizar proveedor",
          message: data.error || "No se pudo actualizar el proveedor.",
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        console.error("Error updating provider:", data.error);
      }
    } catch (error) {
      console.error("Error updating provider:", error);
      showCustomToast({
        title: "Error al actualizar proveedor",
        message: "Error de conexión",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="space-y-2">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Proveedor
        </h4>
        <Button
          size="sm"
          variant={isEditing ? "outline" : "ghost"}
          onClick={handleEdit}
          className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900"
        >
          {!isEditing ? (
            <>
              <Pencil className="mr-1 size-3" />
              Editar
            </>
          ) : (
            <>
              <CircleX className="mr-1 size-3" />
              Cancelar
            </>
          )}
        </Button>
      </div>

      {/* Content Area */}
      {!isEditing ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {tramite.provider || "Sin proveedor"}
              </p>
              <p className="text-xs text-gray-500">
                {tramite.provider
                  ? "Proveedor asignado"
                  : "No hay proveedor asignado"}
              </p>
            </div>
            <Badge
              variant={tramite.provider ? "secondary" : "outline"}
              className={
                tramite.provider
                  ? "shrink-0 bg-gray-200 px-2 py-0.5 text-xs text-gray-800 hover:bg-gray-300"
                  : "shrink-0 border-gray-300 px-2 py-0.5 text-xs text-gray-600"
              }
            >
              {tramite.provider ? "Asignado" : "Sin asignar"}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <InputComponent
            name="provider"
            value={newProvider}
            onChange={handleChange}
            type="text"
            label="Nombre del proveedor"
            placeholder="Introduce el proveedor (dejar vacío para eliminar)"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={isLoading}>
              <CircleCheck className="mr-2 size-4" />
              {isLoading ? "Guardando" : "Guardar"}
            </Button>
            <Button
              size="sm"
              variant="dangerGhost"
              onClick={handleEdit}
              disabled={isLoading}
            >
              <CircleX className="mr-2 size-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
