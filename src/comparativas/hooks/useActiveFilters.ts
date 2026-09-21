import { useMemo } from "react";
import type { DateRange } from "react-day-picker";

interface UseActiveFiltersProps {
  statusFilter: string[] | undefined;
  planFilter: string[] | undefined;
  dateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  isComercial: boolean;
  companyFilter: string[] | undefined;
}

export function useActiveFilters({
  statusFilter,
  planFilter,
  dateRange,
  userFilter,
  isComercial,
  companyFilter,
}: UseActiveFiltersProps) {
  return useMemo(() => {
    const filters: string[] = [];

    if (statusFilter && statusFilter.length > 0) {
      filters.push("Estado");
    }

    if (planFilter && planFilter.length > 0) {
      filters.push("Tipo de plan");
    }

    if (dateRange && (dateRange.from || dateRange.to)) {
      filters.push("Fecha de Creación");
    }

    if (userFilter && userFilter.length > 0 && !isComercial) {
      filters.push("Comercial");
    }

    if (companyFilter && companyFilter.length > 0) {
      filters.push("Compañía");
    }

    return filters;
  }, [
    statusFilter,
    planFilter,
    dateRange,
    userFilter,
    isComercial,
    companyFilter,
  ]);
}
