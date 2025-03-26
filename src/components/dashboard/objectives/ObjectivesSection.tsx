"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CircleX, RefreshCw } from "lucide-react";
import { createEmptyObjective, User } from "@/lib/core/types";
import { Objective } from "../../../lib/core/types";
import { showCustomToast } from "../../core/CustomToast";
import ObjectiveDialog from "./ObjectiveDialog";
import CurrentObjectivesTab from "./CurrentObjectivesTab";
import ObjectivesHistoryTab from "./ObjectivesHistoryTab";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import LoadingStateCard from "../LoadingStateCard";

type ObjetivosCardProps = {
  userData: User;
  loading: boolean;
};

export const ObjetivosCard = ({ userData, loading }: ObjetivosCardProps) => {
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
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
    setLoadingData(true);
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
    } finally {
      setTimeout(() => {
        setLoadingData(false);
        setIsRefreshing(false);
      }, 300);
    }
  }, [userData]);

  useEffect(() => {
    fetchObjetivos();
  }, [fetchObjetivos]);

  const refreshData = () => {
    setIsRefreshing(true);
    setObjetivos([]);
    fetchObjetivos();
  };

  if (loading) {
    return (
      <Card className="h-full w-full">
        <CardHeader className="text-xl font-medium text-primary-800">
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
    <Card className=" relative h-full backdrop-blur-lg transition-colors duration-300 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-50 rounded-full opacity-30 blur-2xl -z-10"></div>
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary-100 rounded-full opacity-40 blur-xl -z-10"></div>
      <CardHeader className="flex flex-row items-center justify-between text-xl font-medium text-primary-800">
        <div className="flex items-start gap-4 w-full">
          <Image
            src="/icons/objetivo.webp"
            alt="Objetivos"
            width={32}
            height={32}
            className="w-auto h-auto object-contain"
          />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl text-primary-800">
                Objetivos
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={refreshData}
                disabled={loadingData || loading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-primary-600 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Mostrando objetivos de{" "}
              <strong className="text-primary-800">{currentMonth}</strong>
            </CardDescription>
          </div>
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
        {!loading && !loadingData && !isRefreshing ? (
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
        ) : (
          <LoadingStateCard userData={userData} />
        )}
      </CardContent>
    </Card>
  );
};
