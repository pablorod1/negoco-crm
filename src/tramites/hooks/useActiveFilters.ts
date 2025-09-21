import { useEffect, useState } from "react";
import { DateRange } from "react-day-picker";

interface UseActiveFiltersParams {
  companyFilter: string[] | undefined;
  statusFilter: string[] | undefined;
  liquidezStatusFilter: string[] | undefined;
  contractTypeFilter: string[] | undefined;
  activationDateRange: DateRange | undefined;
  creationDateRange: DateRange | undefined;
  renovationDateRange: DateRange | undefined;
  collectionDateRange: DateRange | undefined;
  paymentDateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  providerFilter: string[] | undefined;
  isComercial: boolean;
}

export function useActiveFilters({
  companyFilter,
  statusFilter,
  liquidezStatusFilter,
  contractTypeFilter,
  activationDateRange,
  creationDateRange,
  renovationDateRange,
  collectionDateRange,
  paymentDateRange,
  userFilter,
  providerFilter,
  isComercial,
}: UseActiveFiltersParams) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  useEffect(() => {
    const filters = [];

    if (companyFilter && companyFilter.length > 0) filters.push("Compañía");
    if (statusFilter && statusFilter.length > 0) filters.push("Estado");
    if (liquidezStatusFilter && liquidezStatusFilter.length > 0)
      filters.push("Liquidez");
    if (contractTypeFilter && contractTypeFilter.length > 0)
      filters.push("Contrato");
    if (
      activationDateRange &&
      (activationDateRange.from || activationDateRange.to)
    )
      filters.push("Fecha de Activación");
    if (creationDateRange && (creationDateRange.from || creationDateRange.to))
      filters.push("Fecha de Creación");
    if (
      renovationDateRange &&
      (renovationDateRange.from || renovationDateRange.to)
    )
      filters.push("Fecha de Renovación");

    if (
      collectionDateRange &&
      (collectionDateRange.from || collectionDateRange.to)
    )
      filters.push("Fecha de Cobro");
    if (paymentDateRange && (paymentDateRange.from || paymentDateRange.to))
      filters.push("Fecha de Pago");

    if (userFilter && userFilter.length > 0 && !isComercial)
      filters.push("Comercial");

    if (providerFilter && providerFilter.length > 0) filters.push("Proveedor");

    setActiveFilters(filters);
  }, [
    companyFilter,
    statusFilter,
    liquidezStatusFilter,
    contractTypeFilter,
    activationDateRange,
    creationDateRange,
    renovationDateRange,
    collectionDateRange,
    paymentDateRange,
    userFilter,
    isComercial,
    providerFilter,
  ]);

  return activeFilters;
}
