"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, Plus, Calendar, CircleX, CircleCheck } from "lucide-react";
import { createEmptyObjective, ObjectiveType, User } from "@/lib/core/types";
import { ObjetivosAnimatedList } from "./ObjetivosAnimatedList";
import { Objective } from "../../lib/core/types";
import { showCustomToast } from "../core/CustomToast";

type ObjetivosCardProps = {
  userData: User;
  loading: boolean;
};

export const ObjetivosCard = ({ userData, loading }: ObjetivosCardProps) => {
  const [objetivos, setObjetivos] = useState<Objective[]>([]);
  const currentMonth = new Date().toLocaleString("es-ES", {
    month: "long",
  });

  const currentYear = new Date().getFullYear();
  const currentPeriod = `${currentMonth} ${currentYear}`;

  const [open, setOpen] = useState(false);
  const [editingObjetivo, setEditingObjetivo] = useState<Objective | null>(
    null
  );
  const [newObjetivo, setNewObjetivo] = useState<Objective>(
    createEmptyObjective(userData)
  );

  const fetchObjetivos = useCallback(async () => {
    try {
      const res = await fetch(`/api/objectives/get/current`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: userData.id, role: userData.role }),
      });

      const { success, data, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al obtener objetivos",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
      }

      if (data) {
        setObjetivos(data);
      }
    } catch (error) {
      showCustomToast({
        title: "Error al obtener objetivos",
        message: error as string,
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  }, [userData]);

  useEffect(() => {
    fetchObjetivos();
  }, [fetchObjetivos]);

  const handleSaveObjetivo = async () => {
    if (editingObjetivo) {
      // Actualizar objetivo existente
      setObjetivos(
        objetivos.map((obj) =>
          obj.id === editingObjetivo.id
            ? ({ ...obj, ...newObjetivo } as Objective)
            : obj
        )
      );
    } else {
      try {
        const res = await fetch("/api/objectives/create", {
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
        fetchObjetivos();
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

  const handleEditObjetivo = (objetivo: Objective) => {
    setEditingObjetivo(objetivo);
    setNewObjetivo(objetivo);
    setOpen(true);
  };

  if (loading) {
    return (
      <Card className="h-full w-full">
        <CardHeader className="text-xl font-medium text-[var(--primary-color-800)]">
          Objetivos
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 animate-pulse">
            <div className="h-12 bg-gray-200 rounded-md"></div>
            <div className="h-24 bg-gray-200 rounded-md"></div>
            <div className="h-24 bg-gray-200 rounded-md"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full w-full">
      <CardHeader className="flex flex-row items-center justify-between text-xl font-medium text-[var(--primary-color-800)]">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6" />
          <span>
            Objetivos de <strong className="capitalize">{currentMonth}</strong>
          </span>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="bg-[var(--primary-color-600)] hover:bg-[var(--primary-color-700)]"
            >
              <Plus className="h-4 w-4 mr-1" /> Nuevo Objetivo
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                    <SelectItem value="comisiones">
                      Comisiones Generadas
                    </SelectItem>
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
                className="bg-[var(--primary-color-600)] hover:bg-[var(--primary-color-700)]"
              >
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="actuales" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="actuales">Actuales</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="actuales" className="space-y-4">
            {objetivos.length === 0 ? (
              <div className="flex flex-col justify-center items-center w-full py-8 gap-2">
                <Target size={54} className="text-gray-500" />
                <p className="text-center text-gray-500 text-sm">
                  No tienes objetivos establecidos. Crea tu primer objetivo para
                  comenzar a hacer seguimiento.
                </p>
              </div>
            ) : (
              <ObjetivosAnimatedList
                items={objetivos}
                handleEditObjetivo={handleEditObjetivo}
              />
            )}
          </TabsContent>
          <TabsContent value="historico">
            <div className="flex flex-col justify-center items-center w-full py-8 gap-2">
              <Calendar size={54} className="text-gray-500" />
              <p className="text-center text-gray-500 text-sm">
                Aquí podrás ver el historial de tus objetivos completados.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
