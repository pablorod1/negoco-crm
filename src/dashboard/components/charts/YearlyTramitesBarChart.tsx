"use client";
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
import type { TooltipPayloadEntry } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import React from "react";
import {
  CircleX,
  Coins,
  Download,
  FileSpreadsheet,
  Filter,
  FilterX,
  ReceiptEuro,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/core/components/ui/button";
import { TimeRange, User } from "@/core/types";
import { formatComission } from "@/core/utils/format";
import { Label } from "@/core/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { Calendar } from "@/core/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/core/utils";
import TooltipComponent from "@/core/components/TooltipComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  exportRowsToExcel,
  getExportDateStamp,
} from "@/dashboard/utils/exportExcel";

// Chart color configuration using primary palette
const CHART_COLORS = {
  active: "var(--primary-color-500)", // Primary blue for active contracts
  baja: "var(--primary-color-100)", // Muted primary for inactive/cancelled
  comision: "var(--primary-color-400)", // Deeper primary blue for main commission
  comision_sales_person: "var(--primary-color-200)", // Lighter primary for sales commission
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
    field: new Date(2026, i).toLocaleString("es-ES", { month: "long" }),
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
      // Convert DateRange to the format expected by the endpoint
      let formattedDateRange = undefined;

      if (dateRange?.from) {
        const fromDate = dateRange.from.toISOString().split("T")[0];
        const toDate = dateRange.to
          ? dateRange.to.toISOString().split("T")[0]
          : fromDate; // If only from date is selected, use it as both from and to

        formattedDateRange = { from: fromDate, to: toDate };
      }

      const res = await fetch("/api/v2/analytics/contracts/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userData.id,
          role: userData.role,
          time_range: timeRange,
          date_range: formattedDateRange,
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

// Hook para obtener dimensiones del contenedor
const useContainerDimensions = (
  ref: React.RefObject<HTMLDivElement | null>
) => {
  const [dimensions, setDimensions] = React.useState({
    width: 780,
    height: 360,
  });

  React.useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width: width || 780, height: height || 360 });
      }
    });

    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => resizeObserver.disconnect();
  }, [ref]);

  return dimensions;
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

const buildChartExportRows = (data: ChartData[]) =>
  data.map((item) => ({
    "Período": item.field,
    "Trámites activos": item.active,
    "Bajas": Math.abs(item.baja),
    "Comisión total": item.comision,
    "Comisión comercial": item.comision_sales_person,
  }));

// Helper function to check if all data values are zero
const areAllValuesZero = (data: ChartData[], chartView: ChartView): boolean => {
  if (data.length === 0) return false;

  if (chartView === "tramites") {
    return data.every((item) => item.active === 0 && item.baja === 0);
  } else {
    return data.every(
      (item) => item.comision === 0 && item.comision_sales_person === 0
    );
  }
};

// Helper function to get time range display text
const getTimeRangeText = (
  timeRange?: TimeRange,
  dateRange?: DateRange
): string => {
  if (dateRange?.from) {
    const fromDate = dateRange.from.toLocaleDateString("es-ES");
    const toDate = dateRange.to
      ? dateRange.to.toLocaleDateString("es-ES")
      : fromDate;

    if (fromDate === toDate) {
      return `el ${fromDate}`;
    }
    return `del ${fromDate} al ${toDate}`;
  }

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

// Function to generate filter description message
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

// Helper function to format X-axis labels based on time range
const formatXAxisLabel = (value: string, timeRange?: TimeRange): string => {
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
      const weekdayMatch = value.split(",")[0];
      return weekdayMatch ? weekdayMatch : value;

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

// Subcomponents
interface ChartViewToggleProps {
  chartView: ChartView;
  onViewChange: (view: ChartView) => void;
  totals: ReturnType<typeof calculateTotals>;
  isComercial: boolean;
}

const ChartViewToggle: React.FC<ChartViewToggleProps> = React.memo(
  ({ chartView, onViewChange, totals, isComercial }) => (
    <div className="relative flex items-center p-0.5 pe-4 bg-gray-50 rounded-full shadow-sm border border-gray-100">
      <div
        className="absolute  bg-white rounded-full shadow-sm border border-gray-200 transition-all duration-200 ease-out"
        style={{
          left: chartView === "tramites" ? "4px" : "50%",
          width:
            chartView === "tramites" ? "calc(50% - 4px)" : "calc(50% - 1px)",
          height: "calc(100% - 4px)",
        }}
      />

      <ViewToggleButton
        isActive={chartView === "tramites"}
        onClick={() => onViewChange("tramites")}
        icon={<ReceiptEuro size={12} />}
        label="Trámites"
        value={totals.tramites}
        unit="Total"
      />

      <ViewToggleButton
        isActive={chartView === "comision"}
        onClick={() => onViewChange("comision")}
        icon={<Coins size={12} />}
        label="Margen"
        value={isComercial ? totals.comisionSalesPerson : totals.comision}
        unit=""
        isMonetary
      />
    </div>
  )
);

ChartViewToggle.displayName = "ChartViewToggle";

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
      "relative z-10 flex items-center justify-between gap-4 w-1/2 px-3 py-2 rounded-full transition-all duration-200",
      isActive ? "text-gray-900" : "text-gray-600 hover:text-gray-800"
    )}
  >
    <div className="flex items-center gap-1.5 ">
      <span
        className={cn(
          "transition-colors duration-200",
          isActive ? "text-gray-700" : "text-gray-500"
        )}
      >
        {icon}
      </span>
      <span className="font-medium text-xs">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-sm font-semibold">
        {isMonetary ? formatComission(value) : value}
      </span>
      {unit && (
        <span
          className={cn(
            "text-xs",
            isActive ? "text-gray-600" : "text-gray-500"
          )}
        >
          {unit}
        </span>
      )}
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
  onOpen: () => void;
}

const ChartFilters: React.FC<ChartFiltersProps> = ({
  showFilters,
  timeRange,
  dateRange,
  onTimeRangeChange,
  onDateRangeChange,
  onResetDateRange,
  onClose,
  onOpen,
}) => {
  const [isSmallScreen, setIsSmallScreen] = React.useState(false);

  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth <= 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const timeRangeOptions = [
    { value: "year", label: "Este año" },
    { value: "90d", label: "Últimos 90 días" },
    { value: "current_month", label: "Este mes" },
    { value: "current_week", label: "Esta semana" },
    { value: "last_week", label: "La semana pasada" },
  ];

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return "Seleccionar fechas";
    if (!range.to) return range.from.toLocaleDateString("es-ES");
    return `${range.from.toLocaleDateString("es-ES")} - ${range.to.toLocaleDateString("es-ES")}`;
  };

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
        <Button variant="ghost" size="icon" aria-label="Mostrar filtros">
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-2"
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
                    onDateRangeChange(undefined);
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
                    onResetDateRange();
                    onTimeRangeChange("year");
                  }}
                  variant="ghost"
                  size="icon"
                  className={cn("text-red-500 hover:text-red-400")}
                >
                  <FilterX className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="border rounded-lg p-3 bg-gray-50 relative">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={onDateRangeChange}
                numberOfMonths={isSmallScreen ? 1 : 2}
                className="w-full"
              />
            </div>
            {dateRange && (
              <p className="text-xs text-gray-600">
                Seleccionado: {formatDateRange(dateRange)}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ChartContentProps {
  chartData: ChartData[];
  chartView: ChartView;
  isComercial: boolean;
  timeRange?: TimeRange;
  dateRange?: DateRange;
}

const ChartContent: React.FC<ChartContentProps> = ({
  chartData,
  chartView,
  isComercial,
  timeRange,
  dateRange,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { width, height } = useContainerDimensions(containerRef);

  const allValuesZero = areAllValuesZero(chartData, chartView);

  if (chartData.length === 0) {
    return (
      <motion.div
        key="no-data"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center w-full h-[360px] text-gray-500"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z"
                fill="currentColor"
                opacity="0.4"
              />
            </svg>
          </div>
          <div className="flex flex-col items-center space-y-1 text-center">
            <p className="text-lg font-semibold text-gray-900">
              No hay datos disponibles
            </p>
            <p className="text-sm text-gray-600 leading-relaxed max-w-sm">
              No se encontraron datos para el período seleccionado. Verifica tu
              conexión o intenta con otro rango de tiempo.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (allValuesZero) {
    const chartViewText =
      chartView === "tramites"
        ? "trámites registrados"
        : "comisiones registradas";
    const timeText = getTimeRangeText(timeRange, dateRange);

    return (
      <motion.div
        key="zero-data"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center w-full h-[360px]"
      >
        <div className="flex flex-col gap-4 items-center justify-center text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
            {chartView === "tramites" ? (
              <ReceiptEuro className="h-8 w-8 text-amber-500" />
            ) : (
              <Coins className="h-8 w-8 text-amber-500" />
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                No hay {chartViewText} en {timeText}
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                {chartView === "tramites"
                  ? "No se han registrado trámites activos ni bajas en el período seleccionado."
                  : "No se han generado comisiones en el período seleccionado."}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs text-gray-500">
              <div className="bg-gray-50 px-3 py-2 rounded-lg border">
                💡 Prueba a cambiar el rango de tiempo o seleccionar otra vista
              </div>
            </div>
          </div>
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
      transition={{ duration: 0.3 }}
    >
      <div className="h-[360px] w-full">
        <div ref={containerRef} className="w-full h-full">
          <ResponsiveContainer width={"100%"} height={360}>
            <AreaChart
              width={width}
              height={height}
              data={chartData}
              margin={{
                top: 10,
                right: width > 768 ? 30 : 16,
                bottom: 8,
                left: width > 768 ? 30 : 16,
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
                tickFormatter={(value) => formatXAxisLabel(value, timeRange)}
                stroke="#6b7280"
                fontSize={12}
                className="text-xs text-gray-500 capitalize"
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                width={30}
                stroke="#6b7280"
                fontSize={11}
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
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: CHART_COLORS.comision }}
                          />
                          <span>
                            {isComercial ? "Comisión" : "Comisión Total"}
                          </span>
                        </div>
                        {!isComercial && (
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
                        )}
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
                        (entry: TooltipPayloadEntry, index: number) => {
                          const dataKey =
                            typeof entry.dataKey === "string"
                              ? entry.dataKey
                              : String(entry.dataKey ?? "");
                          const color =
                            entry.color ??
                            entry.fill ??
                            entry.stroke ??
                            "var(--primary-color-300)";
                          const value =
                            typeof entry.value === "number"
                              ? entry.value
                              : Number(entry.value ?? 0);
                          const itemKey = dataKey || entry.graphicalItemId;

                          return (
                          <div
                            key={itemKey}
                            className="flex items-center justify-between gap-4 mb-1"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-gray-600">
                                {dataKey === "active"
                                  ? "Activos"
                                  : dataKey === "baja"
                                    ? "Bajas"
                                    : dataKey === "comision"
                                      ? "Comisión Total"
                                      : dataKey === "comision_sales_person"
                                        ? "Comisión Comercial"
                                        : dataKey}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">
                              {value}
                              {chartView === "comision" ? "€" : ""}
                            </span>
                          </div>
                          );
                        }
                      )}
                    </div>
                  );
                }}
              />

              {/* Primary Area - Main data */}
              {!isComercial ? (
                <Area
                  type="monotone"
                  dataKey={chartView === "tramites" ? "active" : "comision"}
                  stroke={
                    chartView === "tramites"
                      ? "var(--primary-color-500)"
                      : "var(--primary-color-500)"
                  }
                  fill={
                    chartView === "tramites"
                      ? "var(--primary-color-500)"
                      : "var(--primary-color-500)"
                  }
                  fillOpacity={0.12}
                  strokeWidth={1}
                />
              ) : isComercial && chartView === "tramites" ? (
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
              ) : isComercial && chartView === "comision" ? (
                <Area
                  type="monotone"
                  dataKey="comision_sales_person"
                  stroke="var(--primary-color-500)"
                  fill="var(--primary-color-500)"
                  fillOpacity={0.12}
                  strokeWidth={1}
                />
              ) : null}

              {/* Secondary Area - Comparison data */}
              <Area
                type="monotone"
                dataKey={
                  chartView === "tramites" ? "baja" : "comision_sales_person"
                }
                stroke={
                  chartView === "tramites"
                    ? "var(--primary-color-400)" // Muted primary for bajas
                    : "var(--primary-color-400)" // Light primary for sales commission
                }
                fill={
                  chartView === "tramites"
                    ? "var(--primary-color-400)"
                    : "var(--primary-color-400)"
                }
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
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
  const [isExporting, setIsExporting] = React.useState(false);

  const { chartData, isRefreshing, refetch } = useChartData(
    userData,
    timeRange,
    dateRange
  );

  const isComercial = userData?.role === "2";

  const totals = React.useMemo(() => calculateTotals(chartData), [chartData]);

  const handleTimeRangeChange = React.useCallback((value: string) => {
    setDateRange(undefined);
    setTimeRange(value as TimeRange);
  }, []);

  const handleDateRangeChange = React.useCallback(
    (range: DateRange | undefined) => {
      // Solo resetear timeRange si realmente se está seleccionando un rango de fecha
      // No lo resetees si range es undefined (viene del reseteo automático)
      if (range && range.from) {
        setTimeRange(undefined);
      }
      setDateRange(range);
    },
    []
  );

  const resetDateRange = React.useCallback(() => {
    setDateRange(undefined);
    setTimeRange("year");
  }, []);

  const handleExport = React.useCallback(async () => {
    setIsExporting(true);
    try {
      const rows = buildChartExportRows(chartData);

      await exportRowsToExcel({
        rows,
        sheetName: "Resumen Global",
        fileName: `Resumen_Global_Ventas_${getExportDateStamp()}`,
      });

      showCustomToast({
        title: "Exportado",
        message: `${rows.length} períodos exportados a Excel`,
        icon: FileSpreadsheet,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
    } catch (error) {
      showCustomToast({
        title: "Error al exportar",
        message:
          error instanceof Error ? error.message : "Error al exportar datos",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setIsExporting(false);
    }
  }, [chartData]);

  return (
    <Card
      variant={"dashboard"}
      className={cn(loading ? "opacity-60" : "", className)}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-50/50 rounded-lg z-10" />
      )}

      {/* Header */}
      <CardHeader
        className={cn(
          "flex justify-between flex-row items-start pb-4 transition-opacity duration-200 relative z-10",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            Resumen Global de Ventas
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 font-extralight">
            {getFilterDescription(timeRange, dateRange)}
          </CardDescription>
        </div>

        <div className="flex items-center gap-4 max-w-xl w-full justify-end">
          <ChartViewToggle
            chartView={chartView}
            onViewChange={setChartView}
            totals={totals}
            isComercial={isComercial}
          />
          <div className="flex items-center justify-center ">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              onClick={refetch}
              disabled={loading || isRefreshing}
              aria-label="Actualizar datos"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
            </Button>
            <TooltipComponent content="Exportar datos a Excel">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                onClick={handleExport}
                disabled={
                  loading ||
                  isRefreshing ||
                  isExporting ||
                  chartData.length === 0
                }
                aria-label="Exportar datos a Excel"
              >
                <Download
                  className={cn("h-3.5 w-3.5", isExporting && "animate-pulse")}
                />
              </Button>
            </TooltipComponent>
            {/* Filters */}
            <AnimatePresence>
              <ChartFilters
                showFilters={showFilters}
                timeRange={timeRange}
                dateRange={dateRange}
                onTimeRangeChange={handleTimeRangeChange}
                onDateRangeChange={handleDateRangeChange}
                onResetDateRange={resetDateRange}
                onClose={() => setShowFilters(false)}
                onOpen={() => setShowFilters(true)}
              />
            </AnimatePresence>
          </div>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent
        className={cn(
          "flex-1 pt-0 transition-opacity duration-200 relative z-10 h-full",
          loading ? "opacity-0" : "opacity-100"
        )}
      >
        <AnimatePresence mode="wait">
          <ChartContent
            chartData={chartData}
            chartView={chartView}
            isComercial={isComercial}
            timeRange={timeRange}
            dateRange={dateRange}
          />
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
