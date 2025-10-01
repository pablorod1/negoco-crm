"use client";

import { X } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { DateRange } from "react-day-picker";
import { COMPARATIVA_STATUS_TYPES } from "@/comparativas/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ActiveFiltersProps {
  statusFilter: string[] | undefined;
  dateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  isComercial: boolean;
  onResetFilters: () => void;
}

export function ActiveFilters({
  statusFilter,
  dateRange,
  userFilter,
  isComercial,
  onResetFilters,
}: ActiveFiltersProps) {
  const hasActiveFilters =
    (statusFilter && statusFilter.length > 0) ||
    (dateRange && (dateRange.from || dateRange.to)) ||
    (userFilter && userFilter.length > 0 && !isComercial);

  if (!hasActiveFilters) return null;

  const getStatusLabel = (values: string[]) => {
    if (values.length === 1) {
      const status = COMPARATIVA_STATUS_TYPES.find(
        (s) => s.value === values[0]
      );
      return status?.label || values[0];
    }
    return `${values.length} estados`;
  };

  const getDateRangeLabel = (range: DateRange) => {
    if (range.from && range.to) {
      return `${format(range.from, "dd/MM/yy", { locale: es })} - ${format(range.to, "dd/MM/yy", { locale: es })}`;
    }
    if (range.from) {
      return `Desde ${format(range.from, "dd/MM/yy", { locale: es })}`;
    }
    if (range.to) {
      return `Hasta ${format(range.to, "dd/MM/yy", { locale: es })}`;
    }
    return "";
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">
          Filtros activos:
        </span>
        <div className="flex gap-2 flex-wrap">
          {statusFilter && statusFilter.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
            >
              <span className="text-xs font-medium">Estado:</span>
              <span className="text-xs">{getStatusLabel(statusFilter)}</span>
            </Badge>
          )}

          {dateRange && (dateRange.from || dateRange.to) && (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
            >
              <span className="text-xs font-medium">Fecha:</span>
              <span className="text-xs">{getDateRangeLabel(dateRange)}</span>
            </Badge>
          )}

          {userFilter && userFilter.length > 0 && !isComercial && (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-gray-200 gap-1.5 flex items-center px-3 py-1"
            >
              <span className="text-xs font-medium">Comerciales:</span>
              <span className="text-xs">
                {userFilter.length} seleccionado(s)
              </span>
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          className="h-7 px-2 text-sm text-gray-500 hover:text-gray-700 ml-2"
        >
          <X className="h-3 w-3 mr-1" />
          Limpiar
        </Button>
      </div>
    </div>
  );
}
