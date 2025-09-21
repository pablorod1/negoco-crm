"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { User } from "@/core/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/core/components/ui/avatar";
import { Users, Filter, RefreshCw } from "lucide-react";
import { Label } from "@/core/components/ui/label";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { cn } from "@/core/utils";
import { AnimatePresence } from "framer-motion";

// Chart color configuration using primary palette (matching YearlyTramites)
const CHART_COLORS = {
  active: "var(--primary-color-500)", // Primary blue for active contracts
  baja: "var(--primary-color-400)", // Muted primary for inactive/cancelled
  comision: "var(--primary-color-500)", // Deeper primary blue for main commission
  comision_sales_person: "var(--primary-color-400)", // Lighter primary for sales commission
};

interface ChartFiltersProps {
  showFilters: boolean;
  timeRange?: "year" | "current_month" | "current_week" | "last_week" | "90d";
  onTimeRangeChange: (value: string) => void;
  onClose: () => void;
  onOpen: () => void;
  disabled?: boolean;
}

const ChartFilters: React.FC<ChartFiltersProps> = ({
  showFilters,
  timeRange,
  onTimeRangeChange,
  onClose,
  onOpen,
  disabled = false,
}) => {
  const timeRangeOptions = [
    { value: "year", label: "Este año" },
    { value: "90d", label: "Últimos 90 días" },
    { value: "current_month", label: "Este mes" },
    { value: "current_week", label: "Esta semana" },
    { value: "last_week", label: "La semana pasada" },
  ];

  return (
    <Popover
      open={showFilters}
      onOpenChange={(open) => {
        if (open) {
          onOpen();
        } else {
          onClose();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mostrar filtros"
          disabled={disabled}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-2"
        align="start"
        side="right"
        sideOffset={8}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="block text-xs font-medium text-gray-700">
              Período predefinido
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {timeRangeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={timeRange === option.value ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs justify-start",
                    timeRange === option.value
                      ? "bg-gray-900 text-white"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                  onClick={() => {
                    onTimeRangeChange(option.value);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface TeamData {
  user: Partial<User>;
  active: number;
  baja: number;
}

interface PersonalData {
  field: string;
  active: number;
  baja: number;
  comision?: number;
  comision_sales_person?: number;
}

type ChartData = TeamData | PersonalData;

export function TeamTramitesBarChart({
  userData,
  loading,
}: {
  userData: User;
  loading: boolean;
}) {
  const [selectedComercial, setSelectedComercial] =
    React.useState<string>("all");
  const [chartData, setChartData] = React.useState<ChartData[]>([]);
  const [timeRange, setTimeRange] = React.useState<
    "year" | "current_month" | "current_week" | "last_week" | "90d" | undefined
  >("year");
  const [comerciales, setComerciales] = React.useState<User[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchTramites = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (selectedComercial === "all") {
        const res = await fetch(
          `/api/v2/analytics/team-performance?id=${userData.id}&role=${userData.role}&time_range=${timeRange}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const { data, success, error } = await res.json();
        if (!success && error) {
          throw new Error(error || "Error fetching tramites");
        }
        setChartData(data as TeamData[]);
        setComerciales([...data.map((item: TeamData) => item.user as User)]);
      } else {
        const res = await fetch(`/api/v2/analytics/contracts/personal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: userData.role,
            id: selectedComercial, // Use the selected comercial ID instead of userData.id
            isSubcomercial: userData.super_id ? true : false,
            time_range: timeRange,
          }),
        });
        const { data, success, error } = await res.json();
        if (!success && error) {
          throw new Error(error || "Error fetching tramites");
        }

        setChartData(data as PersonalData[]);
      }
    } catch (error) {
      console.error("Error al obtener trámites:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [userData, selectedComercial, timeRange]);

  React.useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  // Clear chart data when switching between comercial views to force re-render
  React.useEffect(() => {
    setChartData([]);
    // Small delay to ensure clean state before fetch
    const timer = setTimeout(() => {
      fetchTramites();
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedComercial, fetchTramites]);

  // Function to generate filter description message
  const getFilterDescription = (
    timeRange?: "year" | "current_month" | "current_week" | "last_week" | "90d"
  ): string => {
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

  const handleTimeRangeChange = React.useCallback((value: string) => {
    setTimeRange(
      value as "year" | "current_month" | "current_week" | "last_week" | "90d"
    );
  }, []);

  // Helper function to check if all data values are zero
  const areAllValuesZero = React.useMemo(() => {
    if (chartData.length === 0) return false;

    return chartData.every((item) => {
      if ("user" in item) {
        // TeamData case
        return item.active === 0 && item.baja === 0;
      } else {
        // PersonalData case
        return item.active === 0 && item.baja === 0;
      }
    });
  }, [chartData]);

  // Helper function to get time range display text
  const getTimeRangeText = (timeRange?: string): string => {
    switch (timeRange) {
      case "year":
        return "este año";
      case "90d":
        return "los últimos 90 días";
      case "current_month":
        return "este mes";
      case "current_week":
        return "esta semana";
      case "last_week":
        return "la semana pasada";
      default:
        return "este período";
    }
  };

  // Helper function to format X-axis labels based on time range
  const formatXAxisLabel = (value: string, timeRange?: string): string => {
    // For team view (selectedComercial === "all"), use the name directly
    if (selectedComercial === "all") {
      return value;
    }

    // For individual comercial view, format based on time range
    switch (timeRange) {
      case "90d":
      case "current_month":
        // For 90 days, extract weekday and day number
        // Input: "Domingo 8 Septiembre" -> Output: "Dom 8"
        const parts = value.split(" ");
        if (parts.length >= 2) {
          const weekday = parts[0].substring(0, 3); // First 3 letters of weekday
          const dayNumber = parts[1];
          return `${weekday} ${dayNumber}`;
        }
        // Fallback to just day number if format is unexpected
        const dayMatch = value.match(/\d+/);
        return dayMatch ? dayMatch[0] : value;

      case "current_week":
      case "last_week":
        // For weeks, extract just the weekday name
        // Input: "Lunes 2 Septiembre" -> Output: "Lun"
        const weekdayMatch = value.split(" ")[0];
        return weekdayMatch ? weekdayMatch.substring(0, 3) : value;

      case "year":
        // For year, show month names (usually already formatted)
        return value;

      default:
        // For custom date ranges, show weekday and day numbers
        const customParts = value.split(" ");
        if (customParts.length >= 2) {
          const weekday = customParts[0].substring(0, 3);
          const dayNumber = customParts[1];
          return `${weekday} ${dayNumber}`;
        }
        // Fallback to just day number
        const customDayMatch = value.match(/\d+/);
        return customDayMatch ? customDayMatch[0] : value;
    }
  };

  const dynamicTitle =
    selectedComercial !== "all"
      ? `Resumen de ventas de ${comerciales.find((c) => c.id === selectedComercial)?.name}`
      : "Resumen de ventas de tu equipo";

  return (
    <Card className={cn(loading ? "opacity-60" : "")} variant={"dashboard"}>
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
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <CardTitle className="text-base font-semibold text-gray-900 ">
              {dynamicTitle}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchTramites}
              disabled={loading || isRefreshing}
              aria-label="Actualizar datos"
            >
              <RefreshCw
                className={cn(
                  "h-3 w-3 text-gray-600",
                  isRefreshing && "animate-spin"
                )}
              />
            </Button>
          </div>
          <CardDescription className="text-xs text-gray-500 font-extralight">
            {getFilterDescription(timeRange)}
          </CardDescription>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col space-y-2">
              <Label className="text-xs font-medium text-gray-700 hidden">
                Comercial
              </Label>
              <Select
                disabled={loading || !comerciales || comerciales.length === 0}
                value={selectedComercial}
                onValueChange={setSelectedComercial}
              >
                <SelectTrigger
                  className="w-[240px] h-9  border-gray-200 shadow-sm focus:ring-2 focus:ring-gray-900/10"
                  aria-label="Selecciona una opción"
                >
                  <SelectValue placeholder="Vista General" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" key="all">
                    Vista General
                  </SelectItem>
                  {comerciales.map((comercial) => (
                    <SelectItem
                      key={comercial.id}
                      value={comercial.id}
                      textValue={comercial.name}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={comercial.image as string}
                            alt={comercial.name}
                          />
                          <AvatarFallback className="bg-gray-100 text-gray-700 text-xs">
                            {comercial.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{comercial.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <AnimatePresence>
            <ChartFilters
              showFilters={showFilters}
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              onClose={() => setShowFilters(false)}
              onOpen={() => setShowFilters(true)}
              disabled={false} // Enable filters for both views since both APIs support time_range
            />
          </AnimatePresence>
        </div>
      </CardHeader>
      {/* Content */}
      <CardContent
        className={cn(
          "flex-1 pt-0 transition-opacity duration-200 relative z-10 h-full",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        {chartData.length > 0 && !areAllValuesZero ? (
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                key={`${selectedComercial}-${timeRange}-${chartData.length}`} // Force re-render on layout change
                layout={"horizontal"}
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: selectedComercial === "all" ? 30 : 10,
                  bottom: selectedComercial === "all" ? 60 : 40,
                }}
              >
                <CartesianGrid
                  horizontal={false}
                  vertical={false}
                  strokeDasharray="4 4"
                  stroke="var(--color-primary-100)"
                  opacity={1}
                />
                {selectedComercial === "all" ? (
                  <>
                    <XAxis
                      type="category"
                      dataKey="user.name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      stroke="#6b7280"
                      className="text-[11px]"
                      angle={-45}
                      tickFormatter={(value) => {
                        const name = value.split(" ")[0];
                        const lastNameInitial = value.split(" ")[1]
                          ? value.split(" ")[1].charAt(0) + "."
                          : "";
                        return `${name} ${lastNameInitial}`;
                      }}
                      textAnchor={
                        selectedComercial === "all" ? "end" : undefined
                      }
                    />
                    <YAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={selectedComercial === "all" ? 30 : 5}
                      stroke="#6b7280"
                      className="capitalize  text-[10px]"
                    />
                  </>
                ) : (
                  <>
                    <XAxis
                      type="category"
                      dataKey="field"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      stroke="#6b7280"
                      className="text-[11px] capitalize"
                      angle={-45}
                      textAnchor="end"
                      tickFormatter={(value) =>
                        formatXAxisLabel(value, timeRange)
                      }
                    />
                    <YAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      stroke="#6b7280"
                      className="text-[11px]"
                    />
                  </>
                )}
                <Tooltip
                  content={(props) => {
                    if (!props.active || !props.payload || !props.label)
                      return null;

                    return (
                      <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-xs">
                        <p className="font-medium text-gray-900 mb-2 capitalize">
                          {props.label}
                        </p>
                        {props.payload.map((entry, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-4 mb-1"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-gray-600">
                                {entry.dataKey === "active"
                                  ? "Activos"
                                  : "Bajas"}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="active"
                  fill={CHART_COLORS.active}
                  radius={
                    selectedComercial === "all" ? [0, 4, 4, 0] : [4, 4, 0, 0]
                  }
                  name="Activos"
                />
                <Bar
                  dataKey="baja"
                  fill={CHART_COLORS.baja}
                  radius={
                    selectedComercial === "all" ? [0, 4, 4, 0] : [4, 4, 0, 0]
                  }
                  name="Bajas"
                />
                <Legend
                  verticalAlign="top"
                  content={() => (
                    <div
                      className={cn(
                        "mb-2 flex justify-center gap-6 text-xs text-gray-600",
                        selectedComercial === "all" ? "mt-8" : "mt-12"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: CHART_COLORS.active }}
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
                    </div>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : areAllValuesZero && selectedComercial === "all" ? (
          // All team data is zero
          <div className="flex flex-col gap-4 items-center justify-center h-80 w-full">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
              <Users className="h-8 w-8 text-amber-500" />
            </div>
            <div className="flex flex-col items-center space-y-3 text-center max-w-lg">
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-1">
                  Tu equipo no tiene actividad en {getTimeRangeText(timeRange)}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  No se han registrado trámites activos ni bajas para ningún
                  miembro del equipo en el período seleccionado.
                </p>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border">
                💡 Prueba a cambiar el rango de tiempo para ver datos de otros
                períodos
              </div>
            </div>
          </div>
        ) : areAllValuesZero && selectedComercial !== "all" ? (
          // Selected comercial data is zero
          <div className="flex flex-col gap-4 items-center justify-center h-80 w-full">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
              <Users className="h-8 w-8 text-blue-500" />
            </div>
            <div className="flex flex-col items-center space-y-3 text-center max-w-lg">
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-1">
                  {comerciales.find((c) => c.id === selectedComercial)?.name} no
                  tiene actividad en {getTimeRangeText(timeRange)}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  No se han registrado trámites activos ni bajas para este
                  comercial en el período seleccionado.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-xs text-gray-500">
                <div className="bg-gray-50 px-3 py-2 rounded-lg border">
                  💡 Prueba a seleccionar otro comercial o cambiar el filtro de
                  tiempo
                </div>
              </div>
            </div>
          </div>
        ) : chartData.length === 0 &&
          selectedComercial === "all" &&
          comerciales.length > 0 ? (
          <div className="flex flex-col gap-4 items-center justify-center h-80 w-full">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-gray-400" />
            </div>
            <div className="flex flex-col items-center space-y-1">
              <p className="text-base font-medium text-gray-900">
                Tu equipo todavía no tiene trámites activos
              </p>
              <p className="text-sm text-gray-500">
                Aquí se mostrarán las ventas de tu equipo
              </p>
            </div>
          </div>
        ) : chartData.length === 0 && selectedComercial !== "all" ? (
          <div className="flex flex-col gap-4 items-center justify-center h-80 w-full">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-gray-400" />
            </div>
            <div className="flex flex-col items-center space-y-1">
              <p className="text-base font-medium text-gray-900">
                No hay datos para este período
              </p>
              <p className="text-sm text-gray-500">
                Intenta cambiar el rango de tiempo seleccionado
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-center justify-center h-80 w-full">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-gray-400" />
            </div>
            <div className="flex flex-col items-center space-y-1">
              <p className="text-base font-medium text-gray-900">
                Todavía no tienes comerciales en tu equipo
              </p>
              <p className="text-sm text-gray-500">
                Aquí se mostrarán las ventas de tu equipo
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
