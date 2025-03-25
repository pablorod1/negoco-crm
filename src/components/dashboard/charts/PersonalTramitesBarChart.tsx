"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Building,
  Coins,
  ReceiptEuro,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserIcon,
  XIcon,
} from "lucide-react";
import type { TimeRange, User } from "@/lib/core/types";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { formatComission } from "@/lib/core/format";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { CalendarOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "../DateRangePicker";
import { Label } from "@/components/ui/label";

const chartConfig: ChartConfig = {
  tramites: { label: "Trámites" },
  active: { label: "Activos", color: "var(--primary-color-700)" },
  baja: { label: "Bajas", color: "var(--danger-color)" },
  comision: {
    label: "Comisión",
    color: "var(--primary-color-500)",
  },
  comision_sales_person: {
    label: "Comisión Comercial",
    color: "var(--danger-color)",
  },
};

const comercialChartConfig: ChartConfig = {
  tramites: { label: "Trámites" },
  active: { label: "Activos", color: "var(--primary-color-700)" },
  baja: { label: "Bajas", color: "var(--danger-color)" },
  comision_sales_person: {
    label: "Comisión",
    color: "var(--primary-color-500)",
  },
};

// Generar un array con los 12 meses en español, asegurando que siempre hay datos.
const createEmptyData = () =>
  Array.from({ length: 12 }, (_, i) => ({
    field: new Date(2025, i).toLocaleString("es-ES", { month: "long" }),
    active: 0,
    baja: 0,
    comision: 0,
    comision_sales_person: 0,
  }));

interface ChartData {
  field: string;
  active: number;
  baja: number;
  comision: number;
  comision_sales_person: number;
}

export function PersonalTramitesChart({
  loading,
  userData,
}: {
  loading: boolean;
  userData: User;
}) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("year");
  const [dateRange, setDateRange] = React.useState<DateRange>();
  const [chartData, setChartData] =
    React.useState<ChartData[]>(createEmptyData);
  const [chartView, setChartView] = React.useState<"tramites" | "comision">(
    "tramites"
  );
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const isComercial = userData && userData.role === "2";
  const [showFilters, setShowFilters] = React.useState(false);

  React.useEffect(() => {
    // Añadir la clase personalizada para la animación de resorte
    document.documentElement.style.setProperty(
      "--ease-spring",
      "cubic-bezier(0.25, 0.1, 0.25, 1.5)"
    );
  }, []);

  const fetchData = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/tramites/get/active-tramites-by-user-id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: userData.role,
          id: userData.id,
          isSubcomercial: userData.super_id ? true : false,
          time_range: timeRange,
          date_range: dateRange,
        }),
      });

      const { data, success, error } = await res.json();
      if (!success) {
        console.error("Error fetching personal tramites data:", error);
        return;
      }
      setChartData(data);
    } catch (error) {
      console.error("Error fetching personal tramites data:", error);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 300);
    }
  }, [timeRange, dateRange, userData]);

  const handleTimeRangeChange = (value: string) => {
    setDateRange(undefined);
    setTimeRange(
      value as "year" | "current_month" | "current_week" | "last_week" | "90d"
    );
  };

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setTimeRange(undefined);
    setDateRange(dateRange);
  };

  const resetDateRange = () => {
    setDateRange(undefined);
    setTimeRange("year");
  };

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getActiveTramitesPercentageChange = (data: ChartData[]) => {
    console.log("data", data);
    const currentMonthIndex = new Date().getMonth(); // Índice del mes actual (0 = Enero, 11 = Diciembre)
    const previousMonthIndex =
      currentMonthIndex === 0 ? 11 : currentMonthIndex - 1; // Mes anterior (manejo de diciembre a enero)

    const currentMonthData = data.find((item) =>
      item.field
        .toLowerCase()
        .startsWith(
          new Date(2025, currentMonthIndex)
            .toLocaleString("es-ES", { month: "long" })
            .toLowerCase()
        )
    );

    const previousMonthData = data.find((item) =>
      item.field
        .toLowerCase()
        .startsWith(
          new Date(2025, previousMonthIndex)
            .toLocaleString("es-ES", { month: "long" })
            .toLowerCase()
        )
    );

    const currentActive = currentMonthData?.active ?? 0;
    const previousActive = previousMonthData?.active ?? 0;

    if (previousActive === 0)
      return currentActive > 0 ? currentActive * 100 : 0; // Si no había trámites antes, mostrar 100% si ahora hay más.

    return Math.round(
      ((currentActive - previousActive) / previousActive) * 100
    );
  };

  const formatDifferenceText = (percentageChange: number) => {
    if (percentageChange === 0) {
      return "📊 No hubo cambios en los trámites respecto al mes anterior. ¡Sigamos optimizando la gestión!";
    } else if (percentageChange > 0) {
      if (percentageChange < 10) {
        return `📈 Los trámites aumentaron un ${percentageChange}% en comparación con el mes pasado. Un ligero crecimiento, ¡sigamos organizando el flujo de trabajo!`;
      } else if (percentageChange < 25) {
        return `🚀 ¡Los trámites crecieron un ${percentageChange}% respecto al mes anterior! Un buen indicador de actividad, mantengamos el ritmo.`;
      } else {
        return `🔥 ¡Gran incremento del ${percentageChange}% en trámites este mes! Asegurémonos de gestionar eficazmente esta carga de trabajo.`;
      }
    } else {
      if (percentageChange > -10) {
        return `📉 Los trámites bajaron un ${Math.abs(
          percentageChange
        )}% en comparación con el mes anterior. Puede ser algo puntual, ¡sigamos atentos!`;
      } else if (percentageChange > -25) {
        return `⚠️ Se registró una caída del ${Math.abs(
          percentageChange
        )}% en los trámites este mes. Revisemos si hay factores que la expliquen.`;
      } else {
        return `🚨 Los trámites disminuyeron un ${Math.abs(
          percentageChange
        )}% respecto al mes pasado. Es importante analizar si hay cambios en la demanda o en la gestión.`;
      }
    }
  };

  const totalTramites = chartData.reduce(
    (acc, item) => acc + item.active + item.baja,
    0
  );

  const totalComision = chartData.reduce(
    (acc, item) => acc + item.comision - item.comision_sales_person,
    0
  );

  const totalComisionSalesPerson = chartData.reduce(
    (acc, item) => acc + item.comision_sales_person,
    0
  );

  const refreshData = () => {
    fetchData();
  };

  console.log("chartData", chartData);
  const percentageChange = getActiveTramitesPercentageChange(chartData);
  const isPositiveChange = percentageChange >= 0;

  return (
    <Card
      className={`flex flex-col justify-between relative h-full backdrop-blur-lg transition-colors duration-300 overflow-hidden ${
        loading ? "bg-gray-200 " : "bg-white "
      }`}
    >
      {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-50 rounded-full opacity-30 blur-2xl"></div>
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary-100 rounded-full opacity-40 blur-xl"></div>

      {/* Decorative chart pattern */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-92 opacity-5 pointer-events-none">
        <Image src="/logo.webp" alt="Negoco Cloud" width={256} height={256} />
      </div>

      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>

      <CardHeader
        className={`flex justify-between flex-row transition-opacity duration-300 relative z-10 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl text-[var(--primary-color-800)] flex items-center gap-2">
              Tu Resumen de Ventas
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={refreshData}
                disabled={loading || isRefreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-primary-600 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs rounded-full bg-gray-50 border-gray-200"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3 w-3" />
              Filtros
              {showFilters ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
          <CardDescription className="text-xs text-gray-400">
            Tu resumen de ventas mensuales en 2025
          </CardDescription>
        </div>
        <div className="relative flex items-center p-1 bg-gray-100/50 backdrop-blur-md rounded-xl shadow-inner">
          {/* Indicador deslizante */}
          <div
            className="absolute transition-all duration-300 ease-spring rounded-lg shadow-lg bg-gradient-to-br from-[var(--primary-color-600)] to-[var(--primary-color-800)] z-0"
            style={{
              left: chartView === "tramites" ? "4px" : "calc(50% + 2px)",
              width: userData.super_id ? "calc(100% - 8px)" : "calc(50% - 8px)",
              height: "calc(100% - 8px)",
            }}
          />

          {/* Botón de Trámites */}
          <button
            onClick={() => setChartView("tramites")}
            className={`relative z-10 flex items-center justify-between ${
              userData.super_id ? "w-full" : "w-1/2"
            } px-6 py-3 rounded-lg transition-all duration-300 ${
              chartView === "tramites"
                ? "text-white"
                : "text-gray-700 hover:text-gray-900"
            }`}
          >
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1">
                <ReceiptEuro
                  size={16}
                  className={
                    chartView === "tramites" ? "text-white/80" : "text-gray-500"
                  }
                />
                <span className="font-medium">Trámites</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold">{totalTramites}</span>
                <span
                  className={`text-xs ${
                    chartView === "tramites" ? "text-white/70" : "text-gray-500"
                  }`}
                >
                  Total
                </span>
              </div>
            </div>
          </button>

          {/* Botón de Comisión */}
          {!userData.super_id && (
            <button
              onClick={() => setChartView("comision")}
              className={`relative z-10 flex items-center justify-between w-1/2 px-6 py-3 rounded-lg transition-all duration-300 ${
                chartView === "comision"
                  ? "text-white"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Coins
                    size={16}
                    className={
                      chartView === "comision"
                        ? "text-white/80"
                        : "text-gray-500"
                    }
                  />
                  <span className="font-medium">Comisión</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold">
                    {isComercial
                      ? formatComission(totalComisionSalesPerson)
                      : formatComission(totalComision)}
                  </span>
                </div>
              </div>
            </button>
          )}
        </div>
      </CardHeader>
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-6 pb-2 border-b absolute top-0 left-0 w-full bg-white z-10"
        >
          <div className="flex flex-wrap justify-between items-start gap-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-gray-500">
                  Periodo:
                </Label>
                <Select
                  disabled={dateRange !== undefined}
                  value={timeRange}
                  onValueChange={handleTimeRangeChange}
                >
                  <SelectTrigger
                    className="w-[160px] h-9 text-sm rounded-lg"
                    aria-label="Select a value"
                  >
                    <SelectValue placeholder="Este mes" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="year" className="rounded-lg">
                      Este año
                    </SelectItem>
                    <SelectItem value="90d" className="rounded-lg">
                      Últimos 90 días
                    </SelectItem>
                    <SelectItem value="current_month" className="rounded-lg">
                      Este mes
                    </SelectItem>
                    <SelectItem value="current_week" className="rounded-lg">
                      Esta semana
                    </SelectItem>
                    <SelectItem value="last_week" className="rounded-lg">
                      La semana pasada
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-gray-500">
                  Rango personalizado:
                </Label>
                <div className="flex items-center gap-2">
                  {dateRange && (
                    <Button
                      onClick={resetDateRange}
                      className="bg-transparent h-7 w-7"
                    >
                      <CalendarOff
                        width={16}
                        height={16}
                        stroke="var(--danger-color)"
                      />
                    </Button>
                  )}
                  <DateRangePicker
                    className="h-9 text-sm rounded-lg"
                    date={dateRange}
                    setDateRange={handleDateRangeChange}
                  />
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(false)}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      <CardContent
        className={`transition-opacity duration-300 relative z-10 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <AnimatePresence mode="wait">
          {chartData.length > 0 ? (
            <motion.div
              key="chart-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <ChartContainer
                className="max-h-[300px] h-full w-full"
                config={isComercial ? comercialChartConfig : chartConfig}
              >
                <AreaChart data={chartData}>
                  <ChartLegend
                    content={<ChartLegendContent className="text-sm mt-4" />}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-52"
                        indicator="line"
                        formatter={(value, name, item, index) => {
                          if (isComercial) {
                            return (
                              <>
                                <div>
                                  {comercialChartConfig[
                                    name as keyof typeof comercialChartConfig
                                  ]?.label === "Comisión" ? (
                                    <UserIcon size={14} />
                                  ) : comercialChartConfig[
                                      name as keyof typeof comercialChartConfig
                                    ]?.label === "Activos" ? (
                                    <TrendingUp
                                      size={14}
                                      className="text-success-400"
                                    />
                                  ) : comercialChartConfig[
                                      name as keyof typeof comercialChartConfig
                                    ]?.label === "Bajas" ? (
                                    <TrendingDown
                                      size={14}
                                      className="text-danger-400"
                                    />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                                  )}
                                </div>
                                {comercialChartConfig[
                                  name as keyof typeof comercialChartConfig
                                ]?.label || name}
                                <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                                  {value}
                                  <span className="font-normal text-muted-foreground">
                                    {chartView === "tramites" ? "" : "€"}
                                  </span>
                                </div>
                              </>
                            );
                          }
                          return (
                            <>
                              <div>
                                {chartConfig[name as keyof typeof chartConfig]
                                  ?.label === "Comisión" ? (
                                  <Building size={14} />
                                ) : chartConfig[
                                    name as keyof typeof chartConfig
                                  ]?.label === "Comisión Comercial" ? (
                                  <UserIcon size={14} />
                                ) : chartConfig[
                                    name as keyof typeof chartConfig
                                  ]?.label === "Activos" ? (
                                  <TrendingUp
                                    size={14}
                                    className="text-success-400"
                                  />
                                ) : chartConfig[
                                    name as keyof typeof chartConfig
                                  ]?.label === "Bajas" ? (
                                  <TrendingDown
                                    size={14}
                                    className="text-danger-400"
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                                )}
                              </div>
                              {chartConfig[name as keyof typeof chartConfig]
                                ?.label || name}
                              <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                                {value}
                                <span className="font-normal text-muted-foreground">
                                  {chartView === "tramites" ? "" : "€"}
                                </span>
                              </div>
                              {/* Add this after the last item */}
                              {chartView === "comision" && index === 1 && (
                                <div className="mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium text-foreground">
                                  Total
                                  <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                                    {item.payload.comision -
                                      item.payload.comision_sales_person}
                                    <span className="font-normal text-muted-foreground">
                                      €
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        }}
                      />
                    }
                  />
                  <defs>
                    <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--primary-color-800)"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--primary-color-700)"
                        stopOpacity={0.1}
                      />
                    </linearGradient>

                    <linearGradient id="fillBaja" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--primary-color-500)"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--primary-color-400)"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="field"
                    tickLine={false}
                    tickMargin={24}
                    minTickGap={3}
                    axisLine={false}
                    tickFormatter={(value) => value.slice(0, 3)}
                    className="capitalize overflow-visible"
                  />

                  {!isComercial ? (
                    <Area
                      dataKey={chartView === "tramites" ? "active" : "comision"}
                      type="monotone"
                      fill="url(#fillActive)"
                      fillOpacity={0.4}
                      stroke="var(--primary-color-800)"
                    />
                  ) : isComercial && chartView === "tramites" ? (
                    <Area
                      dataKey="active"
                      type="monotone"
                      fill="url(#fillActive)"
                      fillOpacity={0.4}
                      stroke="var(--primary-color-800)"
                    />
                  ) : null}
                  <Area
                    dataKey={
                      chartView === "tramites"
                        ? "baja"
                        : "comision_sales_person"
                    }
                    type="monotone"
                    fill="url(#fillBaja)"
                    fillOpacity={0.4}
                    stroke="var(--primary-color-500)"
                  />
                </AreaChart>
              </ChartContainer>
            </motion.div>
          ) : (
            <motion.div
              key="no-data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center w-full h-[200px] text-muted-foreground"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z"
                      fill="var(--primary-color-300)"
                    />
                  </svg>
                </div>
                <span className="font-medium text-primary-600 text-center">
                  No hay datos para mostrar
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      <CardFooter
        className={`flex-col items-start gap-2 text-sm transition-opacity duration-300 relative z-10 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center gap-3 font-medium leading-none p-3 rounded-xl bg-gray-50/80 backdrop-blur-sm w-full"
        >
          <div
            className={`size-6 rounded-full flex items-center justify-center ${
              isPositiveChange ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {isPositiveChange ? (
              <TrendingUp className="size-4 text-green-600" />
            ) : (
              <TrendingDown className="size-4 text-red-600" />
            )}
          </div>
          <span className="text-xs text-gray-600">
            {formatDifferenceText(percentageChange)}
          </span>
        </motion.div>
      </CardFooter>
    </Card>
  );
}
