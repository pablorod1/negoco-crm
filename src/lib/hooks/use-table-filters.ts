import { useState } from "react";

export function useTableFilters(id?: string) {
  const [filterValue, setFilterValue] = useState<string>(id ? id : "");
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [contractTypeFilter, setContractTypeFilter] = useState<string[]>([]);
  const [liquidezStatusFilter, setLiquidezStatusFilter] = useState<string[]>(
    []
  );

  const resetFilters = () => {
    setCompanyFilter([]);
    setStatusFilter([]);
    setContractTypeFilter([]);
    setFilterValue("");
    setLiquidezStatusFilter([]);
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
  };
}
