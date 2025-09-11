import { useMemo } from "react";
import type { DateRange } from "react-day-picker";

interface UseActiveFiltersProps {
  statusFilter: string[] | undefined;
  dateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  isComercial: boolean;
  companyFilter: string[] | undefined;
}

export function useActiveFilters({
  statusFilter,
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
  }, [statusFilter, dateRange, userFilter, isComercial, companyFilter]);
}
