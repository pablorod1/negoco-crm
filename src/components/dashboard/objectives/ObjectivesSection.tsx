"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Target, CircleX } from "lucide-react";
import { createEmptyObjective, User } from "@/lib/core/types";
import { Objective } from "../../../lib/core/types";
import { showCustomToast } from "../../core/CustomToast";
import ObjectiveDialog from "./ObjectiveDialog";
import CurrentObjectivesTab from "./CurrentObjectivesTab";
import ObjectivesHistoryTab from "./ObjectivesHistoryTab";

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
        <ObjectiveDialog
          open={open}
          setOpen={setOpen}
          editingObjetivo={editingObjetivo}
          newObjetivo={newObjetivo}
          setNewObjetivo={setNewObjetivo}
          currentPeriod={currentPeriod}
          userData={userData}
          onSubmit={fetchObjetivos}
          setEditingObjetivo={setEditingObjetivo}
        />
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="actuales" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="actuales">Actuales</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="actuales" className="space-y-4">
            <CurrentObjectivesTab
              objetivos={objetivos}
              setEditingObjetivo={setEditingObjetivo}
              setNewObjetivo={setNewObjetivo}
              setOpen={setOpen}
            />
          </TabsContent>
          <TabsContent value="historico">
            <ObjectivesHistoryTab
              setOpen={setOpen}
              setEditingObjetivo={setEditingObjetivo}
              setNewObjetivo={setNewObjetivo}
              userData={userData}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
