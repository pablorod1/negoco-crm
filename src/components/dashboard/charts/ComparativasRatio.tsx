"use client";

import * as React from "react";
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { User } from "@/lib/core/types";
import { CalendarIcon, RefreshCw } from "lucide-react";

import SpinnerComponent from "@/components/core/SpinnerComponent";
import { Divider } from "@heroui/divider";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";

const chartConfig = {
  comparativas: {
    label: "Comparativas",
  },
  procesadas: {
    label: "Procesadas",
    color: "var(--primary-700)",
  },
} satisfies ChartConfig;

interface ComparativasData {
  total: number;
  processed: number;
}

interface ChartData {
  name: string;
  value: number;
  fill: string;
}

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
  const [chartData, setChartData] = React.useState<ChartData[]>([]);
  const [selectedMonth, setSelectedMonth] = React.useState<string>("");
  const [displayMonth, setDisplayMonth] = React.useState<string>("");

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
    setDisplayMonth(
      options[currentMonth].name.charAt(0).toUpperCase() +
        options[currentMonth].name.slice(1)
    );
  }, []);

  const calculateProcesadoPercentage = (data: ComparativasData): number => {
    const { total, processed } = data;

    const sum = total + processed;

    if (sum === 0) {
      return 0; // Para evitar división por cero
    }

    return Math.round((processed / sum) * 100);
  };

  const formatChartData = (data: ComparativasData) => {
    return [
      {
        name: "Procesadas",
        value: data.processed,
        fill: "var(--primary-color-700)",
      },
    ];
  };

  const fetchComparativas = React.useCallback(async () => {
    if (!selectedMonth) return;

    setLoadingData(true);
    setIsRefreshing(true);

    try {
      const res = await fetch(`/api/comparativas/get/converted-ratio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: userData.role,
          id: userData.id,
          month: selectedMonth, // Pasamos la fecha completa
        }),
      });
      const { data, success, error } = await res.json();

      if (!success) {
        throw new Error(error || "Error al obtener comparativas");
      }

      if (data && data.length > 0) {
        const comparativasData: ComparativasData = data[0];
        setComparativasData(comparativasData);
        setChartData(formatChartData(comparativasData));
      } else {
        setComparativasData(null);
        setChartData([]);
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
    // Actualizar el nombre de mes para mostrar
    const selectedOption = monthOptions.find(
      (option) => option.value === value
    );
    if (selectedOption) {
      setDisplayMonth(selectedOption.name);
    }
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

  const startAngle = 90;
  const endAngle = React.useMemo(
    () => startAngle + (procesadoPercentage * -360) / 100,
    [procesadoPercentage]
  );

  const refreshData = () => {
    fetchComparativas();
  };

  return (
    <Card
      className={`flex flex-col justify-between relative h-full backdrop-blur-lg  transition-colors duration-300 overflow-hidden ${
        loading ? "bg-gray-200 " : "bg-white "
      }`}
    >
      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 h-full flex items-center justify-center rounded-lg z-20"
          >
            <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-50 rounded-full opacity-30 blur-2xl"></div>
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary-100 rounded-full opacity-40 blur-xl"></div>

      <CardHeader className="relative z-30">
        <div className="flex items-start justify-between w-full">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl text-[var(--primary-color-800)] flex items-center gap-2">
                Conversión de comparativas
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
            <CardDescription className="text-xs text-gray-400 flex items-center gap-1">
              <span>Mostrando resultados de</span>
              <span className="!capitalize font-medium text-primary-700">
                {displayMonth}
              </span>
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Select
              value={selectedMonth}
              onValueChange={handleMonthChange}
              disabled={monthOptions.length === 0 || loading}
            >
              <SelectTrigger className="w-full max-w-[120px] h-8 text-xs bg-primary-50 border-0 text-primary-700 hover:bg-primary-100 focus:ring-primary-200">
                <CalendarIcon className="size-3.5 text-primary-500" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative flex-1 pb-0 pt-2 z-10">
        <AnimatePresence mode="wait">
          {comparativasData ? (
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
                  <div className="relative w-full h-[280px] flex items-center justify-center">
                    {/* Mantener el gráfico original */}
                    <ChartContainer
                      config={chartConfig}
                      className="w-full mx-auto aspect-square max-h-[300px]"
                    >
                      <RadialBarChart
                        data={chartData}
                        startAngle={startAngle}
                        endAngle={endAngle}
                        innerRadius={80}
                        outerRadius={110}
                      >
                        <PolarGrid
                          gridType="circle"
                          radialLines={false}
                          stroke="none"
                          className="first:fill-primary-100 last:fill-background"
                          polarRadius={[86, 74]}
                        />
                        <RadialBar
                          dataKey="value"
                          fill="var(--primary-700)"
                          cornerRadius={10}
                          animationDuration={1500}
                          animationBegin={300}
                        />
                        <PolarRadiusAxis
                          tick={false}
                          tickLine={false}
                          axisLine={false}
                        >
                          <Label
                            content={({ viewBox }) => {
                              if (
                                viewBox &&
                                "cx" in viewBox &&
                                "cy" in viewBox
                              ) {
                                return (
                                  <motion.g
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.5, duration: 0.5 }}
                                  >
                                    <text
                                      x={viewBox.cx}
                                      y={viewBox.cy}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                    >
                                      <tspan
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        className="fill-primary-800 text-3xl font-bold"
                                      >
                                        {procesadoPercentage}%
                                      </tspan>
                                      <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy || 0) + 24}
                                        className="fill-primary-300"
                                      >
                                        Tramitadas
                                      </tspan>
                                    </text>
                                  </motion.g>
                                );
                              }
                            }}
                          />
                        </PolarRadiusAxis>
                      </RadialBarChart>
                    </ChartContainer>

                    {/* Stats bubbles */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, x: -40 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ delay: 0.7, duration: 0.5 }}
                      className="size-24  absolute top-8 left-6 bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg rounded-full  flex flex-col justify-center items-center"
                    >
                      <NumberTicker
                        className="text-white text-2xl font-bold"
                        value={comparativasData.total}
                      />
                      <span className="text-xs text-white">Completadas</span>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, x: 40 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ delay: 0.9, duration: 0.5 }}
                      className="size-24 absolute bottom-12 right-4 bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg rounded-full  flex flex-col justify-center items-center"
                    >
                      <NumberTicker
                        className="text-white text-2xl font-bold"
                        value={comparativasData.processed}
                      />
                      <span className="text-xs text-white">Tramitadas</span>
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : !loading && loadingData ? (
            <div className="w-full h-full flex justify-center items-center py-12">
              <SpinnerComponent userData={userData} />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full py-12"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-primary-50 flex items-center justify-center">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
                      fill="var(--primary-color-300)"
                    />
                    <path
                      d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z"
                      fill="var(--primary-color-200)"
                    />
                  </svg>
                </div>
                <span className="font-medium text-primary-600 text-center">
                  No hay comparativas para mostrar
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {comparativasData && !loading ? (
        <CardFooter className="justify-between items-end text-sm z-10 pt-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="rounded flex flex-col gap-2 w-full overflow-hidden flex-nowrap mt-4"
          >
            <div className="flex justify-between items-center gap-2 me-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary-300 rounded-full"></div>
                <span className="text-sm text-gray-600">Estudio Realizado</span>
              </div>
              <span className="font-medium">{comparativasData.total}</span>
            </div>
            <Divider className="my-1" />
            <div className="flex justify-between items-center gap-2 me-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                <span className="text-sm text-gray-600">Tramitadas</span>
              </div>
              <span className="font-medium">{comparativasData.processed}</span>
            </div>
          </motion.div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
