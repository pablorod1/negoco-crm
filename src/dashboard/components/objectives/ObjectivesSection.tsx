"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/core/components/ui/card";
import { ResponsiveContainer, RadialBarChart, RadialBar } from "recharts";
import {
  CircleX,
  RefreshCw,
  Target,
  TrendingUp,
  Calendar,
  Edit3,
  Coins,
  ReceiptEuro,
  Scale,
} from "lucide-react";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";
import ObjectiveDialog from "./ObjectiveDialog";
import ObjectivesHistoryTab from "./ObjectivesHistoryTab";
import { Button } from "@/core/components/ui/button";
import LoadingStateCard from "../LoadingStateCard";
import { createEmptyObjective } from "@/dashboard/utils/dashboard.factories";
import { Objective } from "@/dashboard/types";
import { ScrollArea } from "@/core/components/ui/scroll-area";

type ObjetivosCardProps = {
  userData: User;
  loading: boolean;
};

// Minimalist chart configuration
const minimalistChartConfig = {
  colors: {
    excellent: "#059669", // green-600
    good: "#2563eb", // primary-600
    warning: "#d97706", // warning-600
    danger: "#dc2626", // danger-600
    neutral: "#6b7280", // gray-500
  },
  animation: {
    duration: 300,
  },
};

const getObjectiveIcon = (tipo: string) => {
  switch (tipo) {
    case "tramites":
      return <ReceiptEuro className="h-4 w-4" />;
    case "ratio":
      return <Scale className="h-4 w-4" />;
    case "comisiones":
      return <Coins className="h-4 w-4" />;
    default:
      return <Target className="h-4 w-4" />;
  }
};

const getObjectiveLabel = (tipo: string) => {
  switch (tipo) {
    case "tramites":
      return "Trámites";
    case "comisiones":
      return "Comisiones";
    case "ratio":
      return "Conversión";
    default:
      return "Objetivo";
  }
};

const getProgressColor = (percentage: number) => {
  if (percentage >= 100) return minimalistChartConfig.colors.excellent;
  if (percentage >= 80) return minimalistChartConfig.colors.good;
  if (percentage >= 60) return minimalistChartConfig.colors.warning;
  return minimalistChartConfig.colors.danger;
};

const formatValue = (value: number, type: string) => {
  if (type === "comisiones") return `${value.toLocaleString()}€`;
  if (type === "ratio") return `${value}%`;
  return value.toString();
};

// Progress Dashboard Component
const ProgressDashboard = ({
  objetivos,
  onEditObjective,
}: {
  objetivos: Objective[];
  onEditObjective: (objetivo: Objective) => void;
}) => {
  if (objetivos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <Target className="h-8 w-8 text-gray-400" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-medium text-gray-900">
            No hay objetivos establecidos
          </h3>
          <p className="text-sm text-gray-500">
            Crea tu primer objetivo para comenzar el seguimiento
          </p>
        </div>
      </div>
    );
  }

  const totalProgress =
    objetivos.reduce(
      (acc, obj) => acc + Math.min((obj.current / obj.peak) * 100, 100),
      0
    ) / objetivos.length;
  const completedObjectives = objetivos.filter(
    (obj) => obj.current >= obj.peak
  ).length;

  return (
    <div className="space-y-4">
      {/* Overview Section */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Progreso General
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {Math.round(totalProgress)}%
          </div>
        </div>
        <div className="text-right space-y-1">
          <div className="text-sm text-gray-500">Completados</div>
          <div className="text-lg font-semibold text-gray-700">
            {completedObjectives}/{objetivos.length}
          </div>
        </div>
      </div>

      {/* Objectives Grid */}
      <ScrollArea className="max-h-[240px] overflow-y-auto mask-b-from-95% mask-t-from-95%">
        <div className="grid gap-4 p-2">
          {objetivos.map((objetivo) => {
            const percentage = Math.min(
              Math.round((objetivo.current / objetivo.peak) * 100),
              100
            );

            return (
              <div
                key={objetivo.id}
                className={`group relative p-4 rounded-3xl border transition-all duration-200 hover:shadow-md ${
                  objetivo.completed
                    ? "bg-green-50 border-green-200"
                    : "bg-white border-gray-200"
                }`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onEditObjective(objetivo)}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      {getObjectiveIcon(objetivo.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {getObjectiveLabel(objetivo.type)}
                      </h4>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span className="capitalize">{objetivo.period}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Gauge */}
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {percentage}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatValue(objetivo.current, objetivo.type)} /{" "}
                        {formatValue(objetivo.peak, objetivo.type)}
                      </div>
                    </div>
                    <div className="w-12 h-12">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          cx="50%"
                          cy="50%"
                          innerRadius="60%"
                          outerRadius="90%"
                          data={[{ value: percentage }]}
                          startAngle={90}
                          endAngle={90 - percentage * 3.6}
                        >
                          <RadialBar
                            dataKey="value"
                            cornerRadius={3}
                            fill={getProgressColor(percentage)}
                            background={{ fill: "#f3f4f6" }}
                            maxBarSize={8}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

// View toggle types
type ObjectiveView = "actuales" | "historico";

// View Toggle Component
interface ObjectiveViewToggleProps {
  currentView: ObjectiveView;
  onViewChange: (view: ObjectiveView) => void;
  currentCount: number;
}

const ObjectiveViewToggle: React.FC<ObjectiveViewToggleProps> = React.memo(
  ({ currentView, onViewChange }) => (
    <div className="relative flex items-center p-0.5 bg-gray-50 rounded-full shadow-sm border border-gray-100">
      <div
        className="absolute transition-all duration-200 ease-out rounded-full shadow-sm bg-white border border-gray-200 z-0"
        style={{
          left: currentView === "actuales" ? "2px" : "calc(50% + 1px)",
          width: "calc(50% - 3px)",
          height: "calc(100% - 4px)",
        }}
      />

      <ViewToggleButton
        isActive={currentView === "actuales"}
        onClick={() => onViewChange("actuales")}
        icon={<Target size={12} />}
        label="Actuales"
      />

      <ViewToggleButton
        isActive={currentView === "historico"}
        onClick={() => onViewChange("historico")}
        icon={<Calendar size={12} />}
        label="Histórico"
      />
    </div>
  )
);

ObjectiveViewToggle.displayName = "ObjectiveViewToggle";

interface ViewToggleButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const ViewToggleButton: React.FC<ViewToggleButtonProps> = ({
  isActive,
  onClick,
  icon,
  label,
}) => (
  <button
    onClick={onClick}
    className={`relative z-10 flex flex-col items-center justify-center w-1/2 px-3 py-2 rounded-sm transition-all duration-200 ${
      isActive ? "text-gray-900" : "text-gray-600 hover:text-gray-800"
    }`}
  >
    <div className="flex items-center gap-1.5">
      <span
        className={`transition-colors duration-200 ${
          isActive ? "text-gray-700" : "text-gray-500"
        }`}
      >
        {icon}
      </span>
      <span className="font-medium text-xs">{label}</span>
    </div>
  </button>
);

export const ObjetivosCard = ({ userData, loading }: ObjetivosCardProps) => {
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [objetivos, setObjetivos] = useState<Objective[]>([]);
  const [currentView, setCurrentView] = useState<ObjectiveView>("actuales");
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
      const res = await fetch(
        `/api/v2/objectives/current?id=${userData.id}&role=${userData.role}&super_id=${userData.super_id || ""}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

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

  const handleEditObjective = (objetivo: Objective) => {
    setEditingObjetivo(objetivo);
    setNewObjetivo(objetivo);
    setOpen(true);
  };

  if (loading) {
    return (
      <Card className="h-full w-full">
        <CardHeader>
          <CardTitle className="text-xl text-gray-900">Objetivos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 animate-pulse">
            <div className="h-12 bg-gray-200 rounded-xl"></div>
            <div className="h-20 bg-gray-200 rounded-xl"></div>
            <div className="h-20 bg-gray-200 rounded-xl"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="justify-normal gap-6" variant={"dashboard"}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <CardTitle className="text-base text-gray-900">
                Objetivos
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshData}
                disabled={loadingData || loading}
              >
                <RefreshCw
                  className={`h-3 w-3 text-gray-600 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
            <CardDescription className="text-xs text-gray-500">
              Seguimiento de{" "}
              <span className="font-medium capitalize text-gray-700">
                {currentMonth}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ObjectiveViewToggle
              currentView={currentView}
              onViewChange={setCurrentView}
              currentCount={objetivos.length}
            />
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!loading && !loadingData && !isRefreshing ? (
          <>
            {currentView === "actuales" && (
              <div className="space-y-0 mt-0">
                <ProgressDashboard
                  objetivos={objetivos}
                  onEditObjective={handleEditObjective}
                />
              </div>
            )}
            {currentView === "historico" && (
              <div className="mt-0">
                <ObjectivesHistoryTab
                  setOpen={setOpen}
                  setEditingObjetivo={setEditingObjetivo}
                  setNewObjetivo={setNewObjetivo}
                  userData={userData}
                />
              </div>
            )}
          </>
        ) : (
          <LoadingStateCard />
        )}
      </CardContent>
    </Card>
  );
};
