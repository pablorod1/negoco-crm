"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import type { DateRange } from "react-day-picker";
import { Button } from "@/core/components/ui/button";
import { Coins, ReceiptEuro, RefreshCw } from "lucide-react";
import type { TimeRange, User } from "@/core/types";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, FilterX } from "lucide-react";
import { Label } from "@/core/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { Calendar } from "@/core/components/ui/calendar";
import { cn } from "@/core/utils";
import { formatComission } from "@/core/utils/format";

// 🎨 CHART COLORS CONFIGURATION - Consistent with other components
const CHART_COLORS = {
  active: "var(--primary-color-500)", // Primary blue for active contracts
  baja: "var(--primary-color-100)", // Muted primary for inactive/cancelled
  comision: "var(--primary-color-400)", // Deeper primary blue for main commission
  comision_sales_person: "var(--primary-color-200)", // Lighter primary for sales commission
};

// Helper function to get time range display text
const getFilterDescription = (
  timeRange?: TimeRange,
  dateRange?: DateRange
): string => {
  if (dateRange?.from) {
    const fromDate = dateRange.from.toLocaleDateString("es-ES");
    const toDate = dateRange.to
      ? dateRange.to.toLocaleDateString("es-ES")
      : fromDate;

    if (fromDate === toDate) {
      return `Mostrando resultados del ${fromDate}`;
    }
    return `Mostrando resultados del ${fromDate} al ${toDate}`;
  }

  switch (timeRange) {
    case "year":
      return "Mostrando resultados de este año";
    case "90d":
      return "Mostrando resultados de los últimos 90 días";
    case "current_month":
      return "Mostrando resultados de este mes";
    case "current_week":
      return "Mostrando resultados de esta semana";
    case "last_week":
      return "Mostrando resultados de la semana pasada";
    default:
      return "Mostrando resultados de este año";
  }
};
const createEmptyData = () =>
  Array.from({ length: 12 }, (_, i) => ({
    field: new Date(2025, i).toLocaleString("es-ES", { month: "long" }),
    active: 0,
    baja: 0,
    comision: 0,
    comision_sales_person: 0,
  }));

interface ViewToggleProps {
  chartView: "tramites" | "comision";
  onViewChange: (view: "tramites" | "comision") => void;
  totalTramites: number;
  totalComision: number;
  totalComisionSalesPerson: number;
  isComercial: boolean;
  showComisionView: boolean; // Whether to show the comision toggle at all
}

export function ViewToggle({
  chartView,
  onViewChange,
  totalTramites,
  totalComision,
  totalComisionSalesPerson,
  isComercial,
  showComisionView,
}: ViewToggleProps) {
  if (!showComisionView) {
    // Only show tramites view if comision view is not available
    return (
      <div className="flex items-center justify-between gap-2 py-2 px-3 bg-gray-100 rounded-full border border-gray-200 min-w-[120px]">
        <div className="flex items-center gap-2">
          <ReceiptEuro size={12} className="text-gray-600" />
          <span className="font-medium text-xs text-gray-700">Trámites</span>
        </div>
        <span className="text-xs font-semibold text-gray-900">
          {totalTramites}
        </span>
      </div>
    );
  }

  return (
    <div className="relative grid grid-cols-2 bg-gray-50 rounded-full p-1 border border-gray-100">
      {/* Sliding background indicator */}
      <div
        className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm border border-gray-200 transition-all duration-200 ease-out"
        style={{
          left: chartView === "tramites" ? "4px" : "50%",
          width: "calc(50%)",
        }}
      />

      {/* Tramites button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange("tramites")}
        className={`relative z-10  gap-1.5  transition-colors duration-200 justify-start ${
          chartView === "tramites"
            ? "text-gray-900 bg-transparent hover:bg-transparent"
            : "text-gray-600 bg-transparent hover:bg-transparent hover:text-gray-800"
        }`}
      >
        <ReceiptEuro size={12} />
        <span className="font-medium text-xs">Trámites</span>
        <span className="text-xs font-semibold ml-auto">{totalTramites}</span>
      </Button>

      {/* Comision button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange("comision")}
        className={`relative z-10 gap-1.5 w-full transition-colors duration-200 justify-start ${
          chartView === "comision"
            ? "text-gray-900 bg-transparent hover:bg-transparent"
            : "text-gray-600 bg-transparent hover:bg-transparent hover:text-gray-800"
        }`}
      >
        <Coins size={12} />
        <span className="font-medium text-xs">Margen</span>
        <span className="text-xs font-semibold ml-auto">
          {isComercial
            ? formatComission(totalComisionSalesPerson)
            : formatComission(totalComision)}
        </span>
      </Button>
    </div>
  );
}

interface ChartData {
  field: string;
  active: number;
  baja: number;
  comision: number;
  comision_sales_person: number;
}

export default function PersonalTramitesChart({
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

  const fetchData = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/v2/analytics/contracts/personal", {
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
    // Solo resetear timeRange si realmente se está seleccionando un rango de fecha
    // No lo resetees si range es undefined (viene del reseteo automático)
    if (dateRange && dateRange.from) {
      setTimeRange(undefined);
    }
    setDateRange(dateRange);
  };

  const resetDateRange = () => {
    setDateRange(undefined);
    setTimeRange("year");
  };

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  return (
    <Card className={cn(loading ? "opacity-60" : "")} variant={"dashboard"}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-50/50 rounded-lg z-10" />
      )}

      <CardHeader
        className={`flex justify-between flex-row items-start pb-4 transition-opacity duration-200 relative z-10 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <CardTitle className="text-base font-semibold text-gray-900">
              Resumen Personal
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshData}
              disabled={loading || isRefreshing}
              aria-label="Actualizar datos"
            >
              <RefreshCw
                className={`h-3 w-3 text-gray-600 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <CardDescription className="text-xs text-gray-500 font-extralight">
            {getFilterDescription(timeRange, dateRange)}
          </CardDescription>
        </div>
        <div className="flex items-center gap-4 ">
          {/* Metrics toggle */}
          <ViewToggle
            chartView={chartView}
            onViewChange={setChartView}
            totalTramites={totalTramites}
            totalComision={totalComision}
            totalComisionSalesPerson={totalComisionSalesPerson}
            isComercial={isComercial}
            showComisionView={!userData.super_id}
          />

          {/* Filters */}
          <AnimatePresence>
            <Popover
              open={showFilters}
              onOpenChange={(open) => {
                setShowFilters(open);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mostrar filtros"
                >
                  <Filter className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-full"
                align="start"
                side="right"
                sideOffset={8}
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="block text-xs font-medium text-gray-700">
                      Período predefinido
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { value: "year", label: "Este año" },
                        { value: "90d", label: "Últimos 90 días" },
                        { value: "current_month", label: "Este mes" },
                        { value: "current_week", label: "Esta semana" },
                        { value: "last_week", label: "La semana pasada" },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={
                            timeRange === option.value ? "default" : "outline"
                          }
                          size="sm"
                          className={cn(
                            "h-8 text-xs justify-start",
                            timeRange === option.value
                              ? "bg-primary-600 text-white"
                              : "border-gray-200 hover:bg-primary-50"
                          )}
                          onClick={() => {
                            handleTimeRangeChange(option.value);
                            setDateRange(undefined);
                          }}
                          disabled={dateRange !== undefined}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-gray-700">
                        Rango personalizado
                      </Label>
                      {dateRange && (
                        <Button
                          onClick={() => {
                            resetDateRange();
                            handleTimeRangeChange("year");
                          }}
                          variant="ghost"
                          size="icon"
                          className={cn("text-red-500 hover:text-red-400")}
                        >
                          <FilterX className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="w-full rounded-3xl relative">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={handleDateRangeChange}
                        numberOfMonths={2}
                        className="w-full relative"
                      />
                    </div>
                    {dateRange && (
                      <p className="text-xs text-gray-600">
                        Seleccionado:{" "}
                        {dateRange.from
                          ? dateRange.from.toLocaleDateString("es-ES")
                          : ""}
                        {dateRange.to
                          ? ` - ${dateRange.to.toLocaleDateString("es-ES")}`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </AnimatePresence>
        </div>
      </CardHeader>

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
              transition={{ duration: 0.3 }}
            >
              <div className="h-[360px] w-full">
                <ResponsiveContainer width={"100%"} height={360}>
                  <AreaChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 30,
                      bottom: 8,
                      left: 10,
                    }}
                    className="w-full h-full"
                  >
                    <CartesianGrid
                      horizontal={false}
                      vertical={false}
                      strokeDasharray="4 4"
                      stroke="var(--primary-color-100)"
                      opacity={1}
                    />
                    <XAxis
                      dataKey="field"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      tickFormatter={(value) => value.slice(0, 3)}
                      className="text-xs text-gray-500 capitalize"
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      width={30}
                      className="text-[11px] text-gray-500"
                    />
                    <Legend
                      content={() => (
                        <div className="flex justify-center gap-6 mt-8 text-xs text-gray-600">
                          {chartView === "tramites" ? (
                            <>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor: CHART_COLORS.active,
                                  }}
                                />
                                <span>Activos</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS.baja }}
                                />
                                <span>Bajas</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor: CHART_COLORS.comision,
                                  }}
                                />
                                <span>
                                  {isComercial ? "Comisión" : "Comisión Total"}
                                </span>
                              </div>
                              {!isComercial ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      backgroundColor:
                                        CHART_COLORS.comision_sales_person,
                                    }}
                                  />
                                  <span>Comisión Comercial</span>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      )}
                    />
                    <Tooltip
                      content={(props) => {
                        if (!props.active || !props.payload) return null;
                        return (
                          <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-xs">
                            <p className="font-medium text-gray-900 mb-2 capitalize">
                              {props.label}
                            </p>
                            {props.payload.map(
                              (
                                entry: {
                                  dataKey: string;
                                  value: number;
                                  color: string;
                                },
                                index: number
                              ) => (
                                <div
                                  key={index}
                                  className={cn(
                                    "flex items-center justify-between gap-4 mb-1"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-gray-600">
                                      {entry.dataKey === "active"
                                        ? "Activos"
                                        : entry.dataKey === "baja"
                                          ? "Bajas"
                                          : entry.dataKey === "comision"
                                            ? "Comisión"
                                            : entry.dataKey ===
                                                "comision_sales_person"
                                              ? isComercial
                                                ? "Comisión"
                                                : "Comisión Comercial"
                                              : entry.dataKey}
                                    </span>
                                  </div>
                                  <span className="font-medium text-gray-900">
                                    {entry.value}
                                    {chartView === "comision" ? "€" : ""}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        );
                      }}
                    />

                    {/* Primary Area - Main data */}
                    {!isComercial ? (
                      <>
                        <Area
                          type="monotone"
                          dataKey={
                            chartView === "tramites" ? "active" : "comision"
                          }
                          stroke="var(--primary-color-500)"
                          fill="var(--primary-color-500)"
                          fillOpacity={0.12}
                          strokeWidth={1}
                        />
                        {/* Secondary Area - Comparison data for non-comercial users */}
                        <Area
                          type="monotone"
                          dataKey={
                            chartView === "tramites"
                              ? "baja"
                              : "comision_sales_person"
                          }
                          stroke="var(--primary-color-400)"
                          fill="var(--primary-color-400)"
                          fillOpacity={0.1}
                          strokeWidth={2}
                        />
                      </>
                    ) : chartView === "tramites" ? (
                      <>
                        <Area
                          type="monotone"
                          dataKey="active"
                          stroke="var(--primary-color-500)"
                          fill="var(--primary-color-500)"
                          fillOpacity={0.12}
                          strokeWidth={1}
                          dot={{ r: 1, fill: "var(--primary-color-500)" }}
                          activeDot={{
                            r: 1,
                            fill: "var(--primary-color-500)",
                          }}
                        />
                        {/* Secondary Area - Bajas for comercial users */}
                        <Area
                          type="monotone"
                          dataKey="baja"
                          stroke="var(--primary-color-400)"
                          fill="var(--primary-color-400)"
                          fillOpacity={0.1}
                          strokeWidth={2}
                        />
                      </>
                    ) : (
                      /* Solo comision_sales_person para comercial en vista de comision */
                      <Area
                        type="monotone"
                        dataKey="comision_sales_person"
                        stroke="var(--primary-color-500)"
                        fill="var(--primary-color-500)"
                        fillOpacity={0.12}
                        strokeWidth={1}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="no-data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center w-full h-[200px] text-gray-500"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z"
                      fill="hsl(220, 13%, 69%)"
                    />
                  </svg>
                </div>
                <span className="font-medium text-gray-600 text-center text-sm">
                  No hay datos para mostrar
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
