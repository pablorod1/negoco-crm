import { useState } from "react";
import { DateRange } from "react-day-picker";

export function useTableFilters(id?: string) {
  const [filterValue, setFilterValue] = useState<string>(id ? id : "");
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [contractTypeFilter, setContractTypeFilter] = useState<string[]>([]);
  const [liquidezStatusFilter, setLiquidezStatusFilter] = useState<string[]>(
    []
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const resetFilters = () => {
    setCompanyFilter([]);
    setStatusFilter([]);
    setContractTypeFilter([]);
    setFilterValue("");
    setLiquidezStatusFilter([]);
    setDateRange(undefined);
  };

  return {
    filterValue,
    companyFilter,
    statusFilter,
    contractTypeFilter,
    liquidezStatusFilter,
    setFilterValue,
    setCompanyFilter,
    setStatusFilter,
    setContractTypeFilter,
    resetFilters,
    setLiquidezStatusFilter,
    dateRange,
    setDateRange,
  };
}
