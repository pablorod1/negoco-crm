"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { Button } from "@/core/components/ui/button";
import { CircleCheck, CircleX, Plus } from "lucide-react";
import { Objective, ObjectiveType } from "@/dashboard/types";
import { createEmptyObjective } from "@/dashboard/utils/dashboard.factories";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  editingObjetivo: Objective | null;
  newObjetivo: Objective;
  setNewObjetivo: (objetivo: Objective) => void;
  setEditingObjetivo: (objetivo: Objective | null) => void;
  currentPeriod: string;
  onSubmit: () => void;
  userData: User;
}

export default function ObjectiveDialog({
  open,
  setOpen,
  editingObjetivo,
  newObjetivo,
  setNewObjetivo,
  currentPeriod,
  setEditingObjetivo,
  onSubmit,
  userData,
}: Props) {
  const handleSaveObjetivo = async () => {
    if (editingObjetivo) {
      // Create a type-safe changes object for update
      const changes: {
        type?: string;
        peak?: number;
        period?: string;
      } = {};

      // Explicitly check and assign only specific fields
      if (newObjetivo.type !== editingObjetivo.type) {
        changes.type = newObjetivo.type;
      }

      if (newObjetivo.peak !== editingObjetivo.peak) {
        changes.peak = newObjetivo.peak;
      }

      if (newObjetivo.period !== editingObjetivo.period) {
        changes.period = newObjetivo.period;
      }

      // If no changes, show a toast and return
      if (Object.keys(changes).length === 0) {
        showCustomToast({
          title: "Objetivo no modificado",
          message: "No se han realizado cambios en el objetivo",
          icon: CircleX,
          iconColor: "var(--warning-color)",
          iconSize: 24,
        });
        setOpen(false);
        setEditingObjetivo(null);
        return;
      }

      try {
        const res = await fetch(`/api/v2/objectives/${editingObjetivo.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            changes: {
              type: changes.type,
              peak: changes.peak,
              period: changes.period,
            },
          }),
        });

        const { success, error } = await res.json();

        if (!success) {
          showCustomToast({
            title: "Error al actualizar objetivo",
            message: error,
            icon: CircleX,
            iconColor: "var(--danger-color)",
            iconSize: 24,
          });
          return;
        }

        showCustomToast({
          title: "Objetivo actualizado",
          message: "El objetivo se ha actualizado correctamente",
          icon: CircleCheck,
          iconColor: "var(--success-color)",
          iconSize: 24,
        });
        setOpen(false);
        setEditingObjetivo(null);
        onSubmit();
      } catch (error) {
        showCustomToast({
          title: "Error al actualizar objetivo",
          message: error as string,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
      }
    } else {
      try {
        const res = await fetch("/api/v2/objectives", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ objective: newObjetivo }),
        });

        const { success, error } = await res.json();

        if (!success) {
          showCustomToast({
            title: "Error al crear objetivo",
            message: error,
            icon: CircleX,
            iconColor: "var(--danger-color)",
            iconSize: 24,
          });
          return;
        }

        showCustomToast({
          title: "Objetivo creado",
          message: "El objetivo se ha creado correctamente",
          icon: CircleCheck,
          iconColor: "var(--success-color)",
          iconSize: 24,
        });
        onSubmit();
      } catch (error) {
        showCustomToast({
          title: "Error al crear objetivo",
          message: error as string,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }
    }

    setOpen(false);
    setEditingObjetivo(null);
    setNewObjetivo(createEmptyObjective(userData));
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant={"ghost"}>
          <Plus className="h-4 w-4 " />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {editingObjetivo ? "Editar Objetivo" : "Crear Nuevo Objetivo"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="tipo">Tipo de Objetivo</Label>
            <Select
              value={newObjetivo.type}
              onValueChange={(value) =>
                setNewObjetivo({
                  ...newObjetivo,
                  type: value as ObjectiveType,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tramites">Tramites Activos</SelectItem>
                <SelectItem value="ratio">
                  Conversión de Comparativas
                </SelectItem>
                <SelectItem value="comisiones">Comisiones Generadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="meta">
              Meta
              {newObjetivo.type === "comisiones"
                ? " (€)"
                : newObjetivo.type === "ratio"
                  ? " (%)"
                  : ""}
            </Label>
            <Input
              id="meta"
              type="number"
              value={newObjetivo.peak}
              max={newObjetivo.type === "ratio" ? 100 : undefined}
              onChange={(e) =>
                setNewObjetivo({
                  ...newObjetivo,
                  peak: Number.parseInt(e.target.value),
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="periodo">Periodo</Label>
            <Select
              value={newObjetivo.period}
              onValueChange={(value) =>
                setNewObjetivo({ ...newObjetivo, period: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="capitalize" value={currentPeriod}>
                  <span className="capitalize">{currentPeriod}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSaveObjetivo}
            className="bg-primary-600 hover:bg-primary-700"
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
