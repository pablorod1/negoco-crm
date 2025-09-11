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
        <h4 className="text-sm font-medium text-gray-700">Proveedor</h4>
        <Button
          size="sm"
          variant={isEditing ? "outline" : "ghost"}
          onClick={handleEdit}
          className="h-7 px-2 text-gray-600 hover:text-gray-900"
        >
          {!isEditing ? (
            <>
              <Pencil className="h-3 w-3 mr-1" />
              Editar
            </>
          ) : (
            <>
              <CircleX className="h-3 w-3 mr-1" />
              Cancelar
            </>
          )}
        </Button>
      </div>

      {/* Content Area */}
      {!isEditing ? (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
          <div className="flex items-center justify-center">
            {tramite.provider ? (
              <div className="flex flex-col items-center space-y-2">
                <Badge
                  variant="secondary"
                  className="bg-gray-200 text-gray-800 hover:bg-gray-300 px-3 py-1"
                >
                  {tramite.provider}
                </Badge>
                <p className="text-xs text-gray-500">Proveedor asignado</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <Badge
                  variant="outline"
                  className="border-gray-300 text-gray-600 px-3 py-1"
                >
                  Sin Asignar
                </Badge>
                <p className="text-xs text-gray-500">
                  No hay proveedor asignado
                </p>
              </div>
            )}
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
              <CircleCheck className="h-4 w-4 mr-2" />
              {isLoading ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              size="sm"
              variant="dangerGhost"
              onClick={handleEdit}
              disabled={isLoading}
            >
              <CircleX className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
