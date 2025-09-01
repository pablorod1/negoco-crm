"use client";

import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { TramiteVM } from "@/tramites/types";
import { CircleCheck, CircleX, Pencil } from "lucide-react";
import { useState } from "react";
import { InputComponent } from "../createTramite/InputComponent";
import { cn } from "@/core/utils";
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
    <div className="space-y-2 group w-full">
      <p className="text-sm font-medium text-primary-400">Proveedor</p>
      <div className="flex items-center gap-2">
        {!isEditing ? (
          <>
            {tramite.provider ? (
              <Badge variant={"default"}>{tramite.provider}</Badge>
            ) : (
              <Badge>Sin Asignar</Badge>
            )}
          </>
        ) : (
          <InputComponent
            name="provider"
            value={newProvider}
            onChange={handleChange}
            type="text"
            placeholder="Introduce el proveedor (dejar vacío para eliminar)"
          />
        )}
        <Button
          size={"icon"}
          variant={"ghost"}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            isEditing && "opacity-100"
          )}
          onClick={handleEdit}
        >
          {!isEditing ? (
            <Pencil className="w-4 h-4 text-primary-500" />
          ) : (
            <CircleX className="w-4 h-4 text-danger-500" />
          )}
        </Button>
        {isEditing ? (
          <Button
            size={"icon"}
            variant={"ghost"}
            onClick={handleSubmit}
            disabled={isLoading}
          >
            <CircleCheck className="w-4 h-4 text-success-500" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
