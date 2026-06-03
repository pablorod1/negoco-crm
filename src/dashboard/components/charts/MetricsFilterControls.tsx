"use client";

import * as React from "react";
import { CalendarIcon, Filter, FilterX, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/core/components/ui/button";
import { Calendar } from "@/core/components/ui/calendar";
import { Label } from "@/core/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/core/components/ui/select";
import type { TimeRange, User } from "@/core/types";
import { cn } from "@/core/utils";

export const ALL_COMMERCIALS_VALUE = "all";

export interface CommercialOption {
  id: string;
  name: string;
  image: string | null;
}

interface MetricsFilterControlsProps {
  userData: User;
  loading: boolean;
  hasSubComerciales?: boolean;
  selectedCommercialId: string;
  onCommercialChange: (value: string) => void;
  timeRange?: TimeRange;
  onTimeRangeChange: (value: TimeRange) => void;
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const timeRangeOptions: {
  value: Exclude<TimeRange, undefined>;
  label: string;
}[] = [
  { value: "year", label: "Este año" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "current_month", label: "Este mes" },
  { value: "current_week", label: "Esta semana" },
  { value: "last_week", label: "La semana pasada" },
];

export const showCommercialFilterForUser = (
  userData: User,
  hasSubComerciales = false,
) =>
  userData.role === "admin" ||
  userData.role === "1" ||
  (userData.role === "2" && hasSubComerciales);

export const formatDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getFilterDescription = (
  timeRange?: TimeRange,
  dateRange?: DateRange,
) => {
  if (dateRange?.from) {
    const fromDate = dateRange.from.toLocaleDateString("es-ES");
    const toDate = dateRange.to
      ? dateRange.to.toLocaleDateString("es-ES")
      : fromDate;

    if (fromDate === toDate) return `Mostrando resultados del ${fromDate}`;
    return `Mostrando resultados del ${fromDate} al ${toDate}`;
  }

  switch (timeRange) {
    case "90d":
      return "Mostrando resultados de los últimos 90 días";
    case "current_month":
      return "Mostrando resultados de este mes";
    case "current_week":
      return "Mostrando resultados de esta semana";
    case "last_week":
      return "Mostrando resultados de la semana pasada";
    case "year":
    default:
      return "Mostrando resultados de este año";
  }
};

export const buildMetricsParams = ({
  userData,
  selectedCommercialId,
  timeRange,
  dateRange,
}: {
  userData: User;
  selectedCommercialId: string;
  timeRange?: TimeRange;
  dateRange?: DateRange;
}) => {
  const params = new URLSearchParams({
    id: userData.id,
    role: userData.role,
  });

  if (dateRange?.from) {
    params.set("date_from", formatDateParam(dateRange.from));
    params.set("date_to", formatDateParam(dateRange.to ?? dateRange.from));
  } else if (timeRange) {
    params.set("time_range", timeRange);
  }

  if (selectedCommercialId !== ALL_COMMERCIALS_VALUE) {
    params.set("commercialId", selectedCommercialId);
  }

  return params;
};

const formatDateRange = (range: DateRange | undefined) => {
  if (!range?.from) return "Seleccionar fechas";
  if (!range.to) return range.from.toLocaleDateString("es-ES");
  return `${range.from.toLocaleDateString("es-ES")} - ${range.to.toLocaleDateString("es-ES")}`;
};

export function MetricsFilterControls({
  userData,
  loading,
  hasSubComerciales = false,
  selectedCommercialId,
  onCommercialChange,
  timeRange,
  onTimeRangeChange,
  dateRange,
  onDateRangeChange,
}: MetricsFilterControlsProps) {
  const [commercialOptions, setCommercialOptions] = React.useState<
    CommercialOption[]
  >([]);
  const [loadingCommercials, setLoadingCommercials] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [isSmallScreen, setIsSmallScreen] = React.useState(false);
  const showCommercialFilter = showCommercialFilterForUser(
    userData,
    hasSubComerciales,
  );

  React.useEffect(() => {
    const checkScreenSize = () => setIsSmallScreen(window.innerWidth <= 768);

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  React.useEffect(() => {
    if (!showCommercialFilter) {
      setCommercialOptions([]);
      onCommercialChange(ALL_COMMERCIALS_VALUE);
      return;
    }

    let ignore = false;
    setLoadingCommercials(true);

    fetch(
      `/api/v2/users/${userData.id}/all?${new URLSearchParams({ role: userData.role })}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    )
      .then((res) => res.json())
      .then(({ data, success, error }) => {
        if (!success) throw new Error(error || "Error al obtener comerciales");
        if (ignore) return;

        const options = Array.isArray(data)
          ? (data as User[]).map((user) => ({
              id: user.id,
              name: user.name,
              image: user.image,
            }))
          : [];

        setCommercialOptions(options);
        if (
          selectedCommercialId !== ALL_COMMERCIALS_VALUE &&
          !options.some((option) => option.id === selectedCommercialId)
        ) {
          onCommercialChange(ALL_COMMERCIALS_VALUE);
        }
      })
      .catch((error) => {
        console.error("Error al obtener comerciales:", error);
        if (!ignore) {
          setCommercialOptions([]);
          onCommercialChange(ALL_COMMERCIALS_VALUE);
        }
      })
      .finally(() => {
        if (!ignore) setLoadingCommercials(false);
      });

    return () => {
      ignore = true;
    };
  }, [
    onCommercialChange,
    selectedCommercialId,
    showCommercialFilter,
    userData.id,
    userData.role,
  ]);

  const selectedCommercialLabel =
    selectedCommercialId === ALL_COMMERCIALS_VALUE
      ? "Todos"
      : commercialOptions.find((option) => option.id === selectedCommercialId)
          ?.name ?? "Comercial";

  return (
    <div className="flex items-center gap-1.5">
      {showCommercialFilter && (
        <Select
          disabled={loading || loadingCommercials}
          value={selectedCommercialId}
          onValueChange={onCommercialChange}
        >
          <SelectTrigger className="h-8 gap-1.5 border-gray-200 px-2.5 text-xs text-gray-500">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[92px] truncate">
              {selectedCommercialLabel}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COMMERCIALS_VALUE}>
              Todos los comerciales
            </SelectItem>
            {commercialOptions.map((commercial) => (
              <SelectItem key={commercial.id} value={commercial.id}>
                {commercial.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Popover open={showFilters} onOpenChange={setShowFilters}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mostrar filtros">
            <Filter className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-2" align="end" sideOffset={8}>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="block text-xs font-medium text-gray-700">
                Período predefinido
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {timeRangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={
                      timeRange === option.value ? "default" : "outline"
                    }
                    size="sm"
                    className={cn(
                      "h-8 justify-start text-xs",
                      timeRange === option.value
                        ? "bg-gray-900 text-white"
                        : "border-gray-200 hover:bg-gray-50",
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
                      onDateRangeChange(undefined);
                      onTimeRangeChange("year");
                    }}
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-400"
                    aria-label="Limpiar rango personalizado"
                  >
                    <FilterX className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="relative rounded-lg border bg-gray-50 p-3">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from) onTimeRangeChange(undefined);
                    onDateRangeChange(range);
                  }}
                  numberOfMonths={isSmallScreen ? 1 : 2}
                  className="w-full"
                />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-gray-600">
                <CalendarIcon className="h-3 w-3" />
                {formatDateRange(dateRange)}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
