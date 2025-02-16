import { useState } from "react";

export function useTableFilters() {
  const [filterValue, setFilterValue] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [contractTypeFilter, setContractTypeFilter] = useState<string[]>([]);

  const resetFilters = () => {
    setCompanyFilter([]);
    setStatusFilter([]);
    setContractTypeFilter([]);
    setFilterValue("");
  };

  return {
    filterValue,
    companyFilter,
    statusFilter,
    contractTypeFilter,
    setFilterValue,
    setCompanyFilter,
    setStatusFilter,
    setContractTypeFilter,
    resetFilters,
  };
}
