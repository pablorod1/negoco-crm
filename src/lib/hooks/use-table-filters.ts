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
  const [activationDateRange, setActivationDateRange] = useState<
    DateRange | undefined
  >(undefined);
  const [creationDateRange, setCreationDateRange] = useState<
    DateRange | undefined
  >(undefined);
  const [renovationDateRange, setRenovationDateRange] = useState<
    DateRange | undefined
  >(undefined);
  const [collectionDateRange, setCollectionDateRange] = useState<
    DateRange | undefined
  >(undefined);
  const [paymentDateRange, setPaymentDateRange] = useState<
    DateRange | undefined
  >(undefined);

  const resetFilters = () => {
    setCompanyFilter([]);
    setStatusFilter([]);
    setContractTypeFilter([]);
    setFilterValue("");
    setLiquidezStatusFilter([]);
    setActivationDateRange(undefined);
    setCreationDateRange(undefined);
    setRenovationDateRange(undefined);
    setCollectionDateRange(undefined);
    setPaymentDateRange(undefined);
  };

  return {
    filterValue,
    companyFilter,
    statusFilter,
    contractTypeFilter,
    liquidezStatusFilter,
    activationDateRange,
    creationDateRange,
    renovationDateRange,
    collectionDateRange,
    paymentDateRange,
    setFilterValue,
    setCompanyFilter,
    setStatusFilter,
    setContractTypeFilter,
    resetFilters,
    setLiquidezStatusFilter,
    setActivationDateRange,
    setCreationDateRange,
    setRenovationDateRange,
    setCollectionDateRange,
    setPaymentDateRange,
  };
}
