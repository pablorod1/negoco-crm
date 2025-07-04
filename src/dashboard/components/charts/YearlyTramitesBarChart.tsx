"use client";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/core/components/ui/chart";
import React from "react";
import {
  Building,
  CalendarOff,
  ChevronDown,
  ChevronUp,
  Coins,
  Filter,
  ReceiptEuro,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserIcon,
  XIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/core/components/ui/button";
import Image from "next/image";
import { TimeRange, User } from "@/core/types";
import { formatComission } from "@/core/utils/format";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { DateRangePicker } from "../DateRangePicker";
import { DateRange } from "react-day-picker";
import { cn } from "@/core/utils";
import {
  NameType,
  Payload,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

// Chart configurations
const CHART_CONFIG: ChartConfig = {
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

const COMERCIAL_CHART_CONFIG: ChartConfig = {
  tramites: { label: "Trámites" },
  active: { label: "Activos", color: "var(--primary-color-700)" },
  baja: { label: "Bajas", color: "var(--danger-color)" },
  comision_sales_person: {
    label: "Comisión",
    color: "var(--primary-color-500)",
  },
};

// Types
interface ChartData {
  field: string;
  active: number;
  baja: number;
  comision: number;
  comision_sales_person: number;
}

type ChartView = "tramites" | "comision";

interface YearlyTramitesBarChartProps {
  loading: boolean;
  userData: User;
  className?: string;
}

// Utility functions
const createEmptyData = (): ChartData[] =>
  Array.from({ length: 12 }, (_, i) => ({
    field: new Date(2025, i).toLocaleString("es-ES", { month: "long" }),
    active: 0,
    baja: 0,
    comision: 0,
    comision_sales_person: 0,
  }));

// Custom hooks
const useChartData = (
  userData: User,
  timeRange?: TimeRange,
  dateRange?: DateRange
) => {
  const [chartData, setChartData] =
    React.useState<ChartData[]>(createEmptyData);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchTramites = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/tramites/get/monthly-active-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userData.id,
          role: userData.role,
          time_range: timeRange,
          date_range: dateRange,
        }),
      });

      const { data, success, error } = await res.json();
      if (!success && error) {
        console.error("Error al obtener trámites:", error);
        return;
      }
      setChartData(data);
    } catch (error) {
      console.error("Error al obtener trámites:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [userData, timeRange, dateRange]);

  React.useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  return { chartData, isRefreshing, refetch: fetchTramites };
};

// Utility functions for calculations
const calculateTotals = (data: ChartData[]) => ({
  tramites: data.reduce(
    (acc, item) => acc + item.active + Math.abs(item.baja),
    0
  ),
  comision: data.reduce(
    (acc, item) => acc + item.comision - item.comision_sales_person,
    0
  ),
  comisionSalesPerson: data.reduce(
    (acc, item) => acc + item.comision_sales_person,
    0
  ),
});

const getActiveTramitesPercentageChange = (data: ChartData[]) => {
  const currentMonthIndex = new Date().getMonth();
  const previousMonthIndex =
    currentMonthIndex === 0 ? 11 : currentMonthIndex - 1;

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

  if (previousActive === 0) return currentActive > 0 ? currentActive * 100 : 0;
  return Math.round(((currentActive - previousActive) / previousActive) * 100);
};

const formatDifferenceText = (percentageChange: number) => {
  if (percentageChange === 0) {
    return "📊 No hubo cambios en los trámites respecto al mes anterior. ¡Sigamos optimizando la gestión!";
  } else if (percentageChange > 0) {
    if (percentageChange < 10) {
      return `📊 Los trámites aumentaron un ${percentageChange}% en comparación con el mes pasado. Un ligero crecimiento, ¡sigamos organizando el flujo de trabajo!`;
    } else if (percentageChange < 25) {
      return `📊 ¡Los trámites crecieron un ${percentageChange}% respecto al mes anterior! Un buen indicador de actividad, mantengamos el ritmo.`;
    } else {
      return `📊 ¡Gran incremento del ${percentageChange}% en trámites este mes! Asegurémonos de gestionar eficazmente esta carga de trabajo.`;
    }
  } else {
    const absChange = Math.abs(percentageChange);
    if (absChange < 10) {
      return `📊 Los trámites bajaron un ${absChange}% en comparación con el mes anterior. Puede ser algo puntual, ¡sigamos atentos!`;
    } else if (absChange < 25) {
      return `📊 Se registró una caída del ${absChange}% en los trámites este mes. Revisemos si hay factores que la expliquen.`;
    } else {
      return `📊 Los trámites disminuyeron un ${absChange}% respecto al mes pasado. Es importante analizar si hay cambios en la demanda o en la gestión.`;
    }
  }
};

// Subcomponents
interface ChartViewToggleProps {
  chartView: ChartView;
  onViewChange: (view: ChartView) => void;
  totals: ReturnType<typeof calculateTotals>;
  isComercial: boolean;
}

const ChartViewToggle: React.FC<ChartViewToggleProps> = ({
  chartView,
  onViewChange,
  totals,
  isComercial,
}) => (
  <div className="relative flex items-center p-1 bg-gray-100/50 backdrop-blur-md rounded-xl shadow-inner">
    <div
      className="absolute transition-all duration-300 ease-spring rounded-lg shadow-lg bg-gradient-to-br from-primary-600 to-primary-800 z-0"
      style={{
        left: chartView === "tramites" ? "4px" : "calc(50% + 2px)",
        width: "calc(50% - 6px)",
        height: "calc(100% - 8px)",
      }}
    />

    <ViewToggleButton
      isActive={chartView === "tramites"}
      onClick={() => onViewChange("tramites")}
      icon={<ReceiptEuro size={16} />}
      label="Trámites"
      value={totals.tramites}
      unit="Total"
    />

    <ViewToggleButton
      isActive={chartView === "comision"}
      onClick={() => onViewChange("comision")}
      icon={<Coins size={16} />}
      label="Margen"
      value={isComercial ? totals.comisionSalesPerson : totals.comision}
      unit=""
      isMonetary
    />
  </div>
);

interface ViewToggleButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  isMonetary?: boolean;
}

const ViewToggleButton: React.FC<ViewToggleButtonProps> = ({
  isActive,
  onClick,
  icon,
  label,
  value,
  unit,
  isMonetary = false,
}) => (
  <button
    onClick={onClick}
    className={cn(
      "relative z-10 flex items-center justify-between w-1/2 px-6 py-3 rounded-lg transition-all duration-300",
      isActive ? "text-white" : "text-gray-700 hover:text-gray-900"
    )}
  >
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn(isActive ? "text-white/80" : "text-gray-500")}>
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold">
          {isMonetary ? formatComission(value) : value}
        </span>
        <span
          className={cn(
            "text-xs",
            isActive ? "text-white/70" : "text-gray-500"
          )}
        >
          {unit}
        </span>
      </div>
    </div>
  </button>
);

interface ChartFiltersProps {
  showFilters: boolean;
  timeRange?: TimeRange;
  dateRange?: DateRange;
  onTimeRangeChange: (value: string) => void;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onResetDateRange: () => void;
  onClose: () => void;
}

const ChartFilters: React.FC<ChartFiltersProps> = ({
  showFilters,
  timeRange,
  dateRange,
  onTimeRangeChange,
  onDateRangeChange,
  onResetDateRange,
  onClose,
}) => {
  if (!showFilters) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      className="px-6 pb-2 border-b absolute top-0 left-0 w-full bg-white z-10"
    >
      <div className="flex flex-wrap justify-between items-start gap-3 py-3">
        <div className="flex items-center gap-3 mt-2">
          <div className="flex flex-col">
            <Label className="text-xs font-medium text-gray-500">
              Periodo:
            </Label>
            <Select
              disabled={dateRange !== undefined}
              value={timeRange}
              onValueChange={onTimeRangeChange}
            >
              <SelectTrigger
                className="w-[160px] text-sm rounded-md min-h-10 h-auto shadow"
                aria-label="Seleccionar período"
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
          <div className="flex flex-col">
            <Label className="text-xs font-medium text-gray-500">
              Rango personalizado:
            </Label>
            <div className="flex items-center gap-2">
              {dateRange && (
                <Button
                  onClick={onResetDateRange}
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
                date={dateRange}
                setDateRange={onDateRangeChange}
              />
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar filtros"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
};

interface ChartContentProps {
  chartData: ChartData[];
  chartView: ChartView;
  isComercial: boolean;
}

const ChartContent: React.FC<ChartContentProps> = ({
  chartData,
  chartView,
  isComercial,
}) => {
  if (chartData.length === 0) {
    return (
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
    );
  }

  return (
    <motion.div
      key="chart-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <ChartContainer
        className="max-h-[300px] h-full w-full"
        config={isComercial ? COMERCIAL_CHART_CONFIG : CHART_CONFIG}
      >
        <BarChart data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="field"
            tickLine={true}
            tickSize={5}
            tickMargin={15}
            axisLine={false}
            tickFormatter={(value) => value.slice(0, 3)}
            className="capitalize"
          />
          <ChartLegend
            content={<ChartLegendContent className="text-sm mt-4" />}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="w-52"
                indicator="line"
                formatter={(
                  value: ValueType,
                  name: NameType,
                  item: Payload<ValueType, NameType>,
                  index: number
                ) => {
                  const getIcon = (label: string) => {
                    switch (label) {
                      case "Comisión":
                        return isComercial ? (
                          <UserIcon size={14} />
                        ) : (
                          <Building size={14} />
                        );
                      case "Comisión Comercial":
                        return <UserIcon size={14} />;
                      case "Activos":
                        return (
                          <TrendingUp size={14} className="text-success-400" />
                        );
                      case "Bajas":
                        return (
                          <TrendingDown size={14} className="text-danger-400" />
                        );
                      default:
                        return (
                          <div className="w-4 h-4 rounded-full bg-gray-300" />
                        );
                    }
                  };

                  const config = isComercial
                    ? COMERCIAL_CHART_CONFIG
                    : CHART_CONFIG;
                  const label =
                    config[name as keyof typeof config]?.label || name;
                  const icon = getIcon(String(label));

                  return (
                    <>
                      <div>{icon}</div>
                      {label}
                      <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                        {value}
                        <span className="font-normal text-muted-foreground">
                          {chartView === "tramites" ? "" : "€"}
                        </span>
                      </div>
                      {chartView === "comision" &&
                        index === 1 &&
                        item?.payload && (
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
          {!isComercial ? (
            <Bar
              dataKey={chartView === "tramites" ? "active" : "comision"}
              fill="var(--primary-color-800)"
              radius={4}
            />
          ) : isComercial && chartView === "tramites" ? (
            <Bar dataKey="active" fill="var(--primary-color-800)" radius={4} />
          ) : null}
          <Bar
            dataKey={
              chartView === "tramites" ? "baja" : "comision_sales_person"
            }
            fill={
              chartView === "tramites"
                ? "var(--danger-color)"
                : "var(--primary-color-500)"
            }
            radius={4}
          />
        </BarChart>
      </ChartContainer>
    </motion.div>
  );
};

interface PercentageChangeIndicatorProps {
  percentageChange: number;
}

const PercentageChangeIndicator: React.FC<PercentageChangeIndicatorProps> = ({
  percentageChange,
}) => {
  const isPositive = percentageChange >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="flex items-center gap-3 font-medium leading-none p-3 rounded-xl bg-gray-50/80 backdrop-blur-sm w-full"
    >
      <div
        className={cn(
          "size-6 rounded-full flex items-center justify-center",
          isPositive ? "bg-green-100" : "bg-red-100"
        )}
      >
        {isPositive ? (
          <TrendingUp className="size-4 text-green-600" />
        ) : (
          <TrendingDown className="size-4 text-red-600" />
        )}
      </div>
      <span className="text-xs text-gray-600">
        {formatDifferenceText(percentageChange)}
      </span>
    </motion.div>
  );
};

// Main component
export default function YearlyTramitesBarChart({
  loading,
  userData,
  className,
}: YearlyTramitesBarChartProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("year");
  const [dateRange, setDateRange] = React.useState<DateRange>();
  const [chartView, setChartView] = React.useState<ChartView>("comision");
  const [showFilters, setShowFilters] = React.useState(false);

  const { chartData, isRefreshing, refetch } = useChartData(
    userData,
    timeRange,
    dateRange
  );

  const isComercial = userData?.role === "2";
  const isBeenergy = userData?.organization?.name === "Beenergy";

  const totals = React.useMemo(() => calculateTotals(chartData), [chartData]);
  const percentageChange = React.useMemo(
    () => getActiveTramitesPercentageChange(chartData),
    [chartData]
  );

  // Set up spring animation
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--ease-spring",
      "cubic-bezier(0.25, 0.1, 0.25, 1.5)"
    );
  }, []);

  const handleTimeRangeChange = React.useCallback((value: string) => {
    setDateRange(undefined);
    setTimeRange(value as TimeRange);
  }, []);

  const handleDateRangeChange = React.useCallback(
    (range: DateRange | undefined) => {
      setTimeRange(undefined);
      setDateRange(range);
    },
    []
  );

  const resetDateRange = React.useCallback(() => {
    setDateRange(undefined);
    setTimeRange("year");
  }, []);

  return (
    <Card
      className={cn(
        "flex flex-col justify-between relative h-full backdrop-blur-lg transition-colors duration-300 overflow-hidden",
        loading ? "bg-gray-200" : "bg-white",
        className
      )}
    >
      {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-50 rounded-full opacity-30 blur-2xl" />
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary-100 rounded-full opacity-40 blur-xl" />

      {/* Background logo */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-92 opacity-15 pointer-events-none">
        <Image
          src={isBeenergy ? "/beenergy.png" : "/logo_inline.png"}
          alt="Negoco Cloud"
          width={256}
          height={256}
          priority
          className="w-auto h-auto"
        />
      </div>

      {/* Loading overlay */}
      <div
        className={cn(
          "absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300",
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        )}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg" />
      </div>

      {/* Header */}
      <CardHeader
        className={cn(
          "flex justify-between flex-row transition-opacity duration-300 relative z-10",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl text-primary-800 flex items-center gap-2">
              Resumen Global de Ventas
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={refetch}
                disabled={loading || isRefreshing}
                aria-label="Actualizar datos"
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5 text-primary-600",
                    isRefreshing && "animate-spin"
                  )}
                />
              </Button>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs rounded-full bg-gray-50 border-gray-200"
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Mostrar filtros"
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
          <CardDescription className="text-xs text-primary-400">
            Resumen de las ventas de{" "}
            <strong>{userData.organization.name}</strong> en 2025
          </CardDescription>
        </div>

        <ChartViewToggle
          chartView={chartView}
          onViewChange={setChartView}
          totals={totals}
          isComercial={isComercial}
        />
      </CardHeader>

      {/* Filters */}
      <ChartFilters
        showFilters={showFilters}
        timeRange={timeRange}
        dateRange={dateRange}
        onTimeRangeChange={handleTimeRangeChange}
        onDateRangeChange={handleDateRangeChange}
        onResetDateRange={resetDateRange}
        onClose={() => setShowFilters(false)}
      />

      {/* Content */}
      <CardContent
        className={cn(
          "transition-opacity duration-300 relative z-10",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <AnimatePresence mode="wait">
          <ChartContent
            chartData={chartData}
            chartView={chartView}
            isComercial={isComercial}
          />
        </AnimatePresence>
      </CardContent>

      {/* Footer */}
      <CardFooter
        className={cn(
          "flex-col items-start gap-2 text-sm transition-opacity duration-300 relative z-10",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <PercentageChangeIndicator percentageChange={percentageChange} />
      </CardFooter>
    </Card>
  );
}
