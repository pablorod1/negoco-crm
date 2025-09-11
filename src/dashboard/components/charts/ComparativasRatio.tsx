"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/core/components/ui/select";
import type { User } from "@/core/types";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { NumberTicker } from "@/core/components/ui/number-ticker";
import { Button } from "@/core/components/ui/button";
import LoadingStateCard from "../LoadingStateCard";
import { cn } from "@/core/utils";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// Chart color configuration using primary palette (matching other components)
const CHART_COLORS = {
  completed: "var(--color-blue-500)", // Primary blue for completed
  remaining: "var(--color-blue-100)", // Light primary for remaining
  total: "var(--color-blue-400)", // Medium primary for total
};

interface ComparativasData {
  total: number;
  processed: number;
}

// Minimalist Gauge Chart Component using Recharts
interface GaugeChartProps {
  percentage: number;
  total: number;
  processed: number;
}

const GaugeChart: React.FC<GaugeChartProps> = ({
  percentage,
  total,
  processed,
}) => {
  const getProgressColor = (percent: number) => {
    if (percent >= 80) return "var(--color-blue-600)"; // primary-600 for excellent
    if (percent >= 60) return "var(--color-warning-600)"; // warning-600 for good
    return "var(--color-danger-600)"; // danger-600 for needs attention
  };

  const getProgressColorClass = (percent: number) => {
    if (percent >= 80) return "text-blue-600";
    if (percent >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Prepare data for gauge visualization
  const gaugeData = [
    {
      name: "completed",
      value: percentage,
      color: getProgressColor(percentage),
    },
    {
      name: "remaining",
      value: 100 - percentage,
      color: CHART_COLORS.remaining.replace("var(--color-blue-100)", "#dbeafe"),
    },
  ];

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-8"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      {/* Recharts Gauge Implementation */}
      <div className="relative w-40 h-40 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={70}
              dataKey="value"
              stroke="none"
            >
              {gaugeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center content overlaid */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            className={cn(
              "text-3xl font-bold",
              getProgressColorClass(percentage)
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.8 }}
          >
            <NumberTicker
              value={percentage}
              className={getProgressColorClass(percentage)}
            />
            %
          </motion.div>
          <motion.span
            className="text-xs text-gray-500 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 1 }}
          >
            Completado
          </motion.span>
        </div>

        {/* Progress indicator marks */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-32 h-16">
            {/* 25% mark */}
            <div className="absolute left-2 bottom-0 w-0.5 h-3 bg-gray-300"></div>
            {/* 50% mark */}
            <div className="absolute left-1/2 -translate-x-0.5 -bottom-1 w-0.5 h-4 bg-gray-300"></div>
            {/* 75% mark */}
            <div className="absolute right-2 bottom-0 w-0.5 h-3 bg-gray-300"></div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <motion.div
        className="flex justify-between w-full max-w-xs gap-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 1.2 }}
      >
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">
            <NumberTicker value={processed} />
          </p>
          <p className="text-xs text-gray-500">Procesadas</p>
        </div>
        <div className="w-px h-8 bg-gray-200"></div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">
            <NumberTicker value={total} />
          </p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Definir la estructura de meses con número y nombre
interface MonthOption {
  value: string; // Valor para la API (formato YYYY-MM-DD)
  label: string; // Texto para mostrar
  name: string; // Nombre del mes
}

export function ComparativasRatio({
  userData,
  loading,
}: {
  userData: User;
  loading: boolean;
}) {
  const [comparativasData, setComparativasData] =
    React.useState<ComparativasData | null>(null);
  const [selectedMonth, setSelectedMonth] = React.useState<string>("");
  const [loadingData, setLoadingData] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [monthOptions, setMonthOptions] = React.useState<MonthOption[]>([]);

  // Generar opciones de mes
  React.useEffect(() => {
    const currentYear = new Date().getFullYear();
    const options: MonthOption[] = [];

    for (let i = 0; i < 12; i++) {
      // Crear fecha para el primer día de cada mes
      const date = new Date(currentYear, i, 1);
      const monthValue = `${currentYear}-${String(i + 1).padStart(2, "0")}-01`;
      const monthName = date.toLocaleString("es-ES", { month: "long" });
      const capitalizedName =
        monthName.charAt(0).toUpperCase() + monthName.slice(1);

      options.push({
        value: monthValue,
        label: capitalizedName,
        name: monthName,
      });
    }

    setMonthOptions(options);

    // Establecer el mes actual como predeterminado
    const currentMonth = new Date().getMonth();
    setSelectedMonth(options[currentMonth].value);
  }, []);

  const calculateProcesadoPercentage = (data: ComparativasData): number => {
    const { total, processed } = data;

    const sum = total + processed;

    if (sum === 0) {
      return 0; // Para evitar división por cero
    }

    return Math.round((processed / sum) * 100);
  };

  const fetchComparativas = React.useCallback(async () => {
    if (!selectedMonth) return;

    setLoadingData(true);
    setIsRefreshing(true);

    try {
      const res = await fetch(
        `/api/v2/analytics/comparisons?metric=converted-ratio&id=${userData.id}&role=${userData.role}&month=${selectedMonth}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const { data, success, error } = await res.json();

      if (!success) {
        throw new Error(error || "Error al obtener comparativas");
      }

      if (data && data.length > 0) {
        const comparativasData: ComparativasData = data[0];
        setComparativasData(comparativasData);
      } else {
        setComparativasData(null);
      }
    } catch (error) {
      console.error("Error al obtener comparativas:", error);
      setComparativasData(null);
    } finally {
      setTimeout(() => {
        setLoadingData(false);
        setIsRefreshing(false);
      }, 300);
    }
  }, [userData, selectedMonth]);

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
  };

  React.useEffect(() => {
    if (selectedMonth) {
      fetchComparativas();
    }
  }, [fetchComparativas, selectedMonth]);

  const procesadoPercentage = React.useMemo(() => {
    if (comparativasData) {
      return calculateProcesadoPercentage(comparativasData);
    }
    return 0;
  }, [comparativasData]);

  const refreshData = () => {
    fetchComparativas();
  };

  return (
    <Card variant={"dashboard"} className={cn(loading ? "opacity-60" : "")}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-50/50 rounded-lg z-10" />
      )}

      <CardHeader
        className={cn(
          "flex justify-between flex-row items-start pb-4 transition-opacity duration-200 relative z-10",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            Ratio de Comparativas
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 font-extralight">
            Progreso de procesamiento mensual
          </CardDescription>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col space-y-2">
              <Select
                disabled={loading || monthOptions.length === 0}
                value={selectedMonth}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger className="w-[180px] h-9 rounded-lg border-gray-200 shadow-sm focus:ring-2 focus:ring-gray-900/10">
                  <CalendarIcon className="h-3.5 w-3.5 text-gray-500" />
                  <span className="truncate">
                    {monthOptions.find((opt) => opt.value === selectedMonth)
                      ?.label || "Seleccionar mes"}
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              onClick={refreshData}
              disabled={loading || isRefreshing}
              aria-label="Actualizar datos"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "flex-1 pt-0 transition-opacity duration-200 relative z-10 h-full",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <AnimatePresence mode="wait">
          {comparativasData && !loading ? (
            <div className="relative w-full h-full">
              {/* Chart View */}
              <AnimatePresence mode="wait">
                <motion.div
                  key="chart-view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full"
                >
                  <div className="relative w-full h-[360px] flex items-center justify-center">
                    {/* Recharts Gauge Chart Implementation */}
                    <GaugeChart
                      percentage={procesadoPercentage}
                      total={comparativasData?.total ?? 0}
                      processed={comparativasData?.processed ?? 0}
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : !loading && loadingData ? (
            <div className="w-full h-full flex justify-center items-center py-12">
              <LoadingStateCard />
            </div>
          ) : comparativasData === null && !loading && !loadingData ? (
            /* Empty state */
            <div className="flex flex-col gap-4 items-center justify-center h-80 w-full">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                <CalendarIcon className="h-8 w-8 text-amber-500" />
              </div>
              <div className="flex flex-col items-center space-y-3 text-center max-w-lg">
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-1">
                    Sin datos para este período
                  </p>
                  <p className="text-sm text-gray-500">
                    No se encontraron comparativas para el mes seleccionado
                  </p>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border">
                  💡 Intenta seleccionar otro mes con actividad registrada
                </div>
              </div>
            </div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
