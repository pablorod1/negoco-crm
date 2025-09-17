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

// Minimalist color configuration following design system
const MINIMALIST_COLORS = {
  primary: "#2563eb", // primary-600 - for progress indicator only
  background: "#f3f4f6", // gray-100 - for remaining portion
  text: {
    primary: "#111827", // gray-900 - for main numbers
    secondary: "#6b7280", // gray-500 - for labels
    muted: "#9ca3af", // gray-400 - for subtle text
  },
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
  // Simplified color logic - only primary for progress, gray for background
  const progressColor = MINIMALIST_COLORS.primary;

  // Minimalist gauge data - only two segments
  const gaugeData = [
    {
      name: "completed",
      value: percentage,
      color: progressColor,
    },
    {
      name: "remaining",
      value: 100 - percentage,
      color: MINIMALIST_COLORS.background,
    },
  ];

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-6"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      {/* Larger Minimalist Recharts Gauge */}
      <div className="relative w-48 h-48 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={85}
              dataKey="value"
              stroke="none"
            >
              {gaugeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Enhanced center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            className="text-3xl font-bold text-gray-900 mb-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.8 }}
          >
            <NumberTicker value={percentage} className="text-gray-900" />%
          </motion.div>
          <motion.span
            className="text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 1 }}
          >
            Completado
          </motion.span>
        </div>
      </div>

      {/* Enhanced stats layout */}
      <motion.div
        className="flex justify-between w-full max-w-md gap-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 1.2 }}
      >
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-900 mb-1">
            <NumberTicker value={processed} />
          </p>
          <p className="text-sm text-gray-500">Procesadas</p>
        </div>
        <div className="w-px h-10 bg-gray-200"></div>
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-900 mb-1">
            <NumberTicker value={total} />
          </p>
          <p className="text-sm text-gray-500">Total</p>
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
          "flex justify-between flex-row items-start pb-6 transition-opacity duration-200 relative z-10",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="flex flex-col gap-2">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            Ratio de Comparativas
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Progreso de procesamiento mensual
          </CardDescription>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <Select
              disabled={loading || monthOptions.length === 0}
              value={selectedMonth}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[160px] h-9 rounded-lg border-gray-200 shadow-sm focus:ring-2 focus:ring-gray-900/10 text-sm">
                <CalendarIcon className="h-4 w-4 text-gray-500" />
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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            onClick={refreshData}
            disabled={loading || isRefreshing}
            aria-label="Actualizar datos"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "flex-1 pt-0 transition-opacity duration-200 relative z-10 h-full px-6 pb-6",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <AnimatePresence mode="wait">
          {comparativasData && !loading ? (
            <div className="relative w-full h-full">
              {/* Minimalist Chart View */}
              <AnimatePresence mode="wait">
                <motion.div
                  key="chart-view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full"
                >
                  <div className="relative w-full h-[380px] flex items-center justify-center">
                    {/* Enhanced Recharts Gauge Implementation */}
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
            /* Minimalist empty state */
            <div className="flex flex-col gap-6 items-center justify-center h-80 w-full">
              <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center border border-gray-200">
                <CalendarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="flex flex-col items-center space-y-3 text-center max-w-sm">
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    Sin datos disponibles
                  </p>
                  <p className="text-sm text-gray-500">
                    No se encontraron comparativas para el mes seleccionado
                  </p>
                </div>
                <div className="text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                  Intenta seleccionar otro mes con actividad registrada
                </div>
              </div>
            </div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
