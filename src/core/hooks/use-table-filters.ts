import { useState, useEffect, useCallback, useRef } from "react";
import { DateRange } from "react-day-picker";

export function useTableFilters(id?: string) {
  const storageKey = `table-filters-${id || "default"}`;
  const [filterValue, setFilterValue] = useState<string>("");
  const initialLoadComplete = useRef(false);

  const getInitialValues = () => {
    if (typeof window === "undefined") return {};

    try {
      const savedFilters = localStorage.getItem(storageKey);
      if (savedFilters) {
        return JSON.parse(savedFilters);
      }
    } catch (error) {
      console.error("Error loading filters from localStorage:", error);
    }
    return {};
  };

  const initialValues = getInitialValues();

  // State for all filters
  const [companyFilter, setCompanyFilter] = useState<string[] | undefined>(
    initialValues.companyFilter
  );
  const [providerFilter, setProviderFilter] = useState<string[] | undefined>(
    initialValues.providerFilter
  );
  const [statusFilter, setStatusFilter] = useState<string[] | undefined>(
    initialValues.statusFilter
  );
  const [contractTypeFilter, setContractTypeFilter] = useState<
    string[] | undefined
  >(initialValues.contractTypeFilter);
  const [liquidezStatusFilter, setLiquidezStatusFilter] = useState<
    string[] | undefined
  >(initialValues.liquidezStatusFilter);
  const [activationDateRange, setActivationDateRange] = useState<
    DateRange | undefined
  >(initialValues.activationDateRange);
  const [creationDateRange, setCreationDateRange] = useState<
    DateRange | undefined
  >(initialValues.creationDateRange);
  const [renovationDateRange, setRenovationDateRange] = useState<
    DateRange | undefined
  >(initialValues.renovationDateRange);
  const [collectionDateRange, setCollectionDateRange] = useState<
    DateRange | undefined
  >(initialValues.collectionDateRange);
  const [paymentDateRange, setPaymentDateRange] = useState<
    DateRange | undefined
  >(initialValues.paymentDateRange);

  const [userFilter, setUserFilter] = useState<string[] | undefined>(
    initialValues.userFilter
  );

  const [typeFilter, setTypeFilter] = useState<string[] | undefined>(
    initialValues.typeFilter
  );

  const [excludeCompany, setExcludeCompany] = useState<boolean>(
    initialValues.excludeCompany ?? false
  );
  const [excludeUser, setExcludeUser] = useState<boolean>(
    initialValues.excludeUser ?? false
  );

  // Try to load filters from localStorage on initial load
  const loadFiltersFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const savedFilters = localStorage.getItem(storageKey);
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);

        // Only set states if values exist in storage and are different from current state
        if (parsedFilters.companyFilter)
          setCompanyFilter(parsedFilters.companyFilter);
        if (parsedFilters.statusFilter)
          setStatusFilter(parsedFilters.statusFilter);
        if (parsedFilters.contractTypeFilter)
          setContractTypeFilter(parsedFilters.contractTypeFilter);
        if (parsedFilters.liquidezStatusFilter)
          setLiquidezStatusFilter(parsedFilters.liquidezStatusFilter);
        if (parsedFilters.activationDateRange)
          setActivationDateRange(parsedFilters.activationDateRange);
        if (parsedFilters.creationDateRange)
          setCreationDateRange(parsedFilters.creationDateRange);
        if (parsedFilters.renovationDateRange)
          setRenovationDateRange(parsedFilters.renovationDateRange);
        if (parsedFilters.collectionDateRange)
          setCollectionDateRange(parsedFilters.collectionDateRange);
        if (parsedFilters.paymentDateRange)
          setPaymentDateRange(parsedFilters.paymentDateRange);
        if (parsedFilters.userFilter) setUserFilter(parsedFilters.userFilter);

        if (parsedFilters.typeFilter) setTypeFilter(parsedFilters.typeFilter);
        if (parsedFilters.providerFilter)
          setProviderFilter(parsedFilters.providerFilter);
        if (parsedFilters.excludeCompany !== undefined)
          setExcludeCompany(parsedFilters.excludeCompany);
        if (parsedFilters.excludeUser !== undefined)
          setExcludeUser(parsedFilters.excludeUser);
      }
    } catch (error) {
      console.error("Error loading filters from localStorage:", error);
    }
  }, [storageKey]);

  // Load filters from localStorage on initial render only
  useEffect(() => {
    if (!initialLoadComplete.current) {
      loadFiltersFromStorage();
      initialLoadComplete.current = true;
    }
  }, [loadFiltersFromStorage]);

  // Save filters to localStorage
  const saveFiltersToStorage = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const filtersToSave = {
        companyFilter,
        statusFilter,
        contractTypeFilter,
        liquidezStatusFilter,
        activationDateRange,
        creationDateRange,
        renovationDateRange,
        collectionDateRange,
        paymentDateRange,
        userFilter,
        typeFilter,
        providerFilter,
        excludeCompany,
        excludeUser,
      };
      localStorage.setItem(storageKey, JSON.stringify(filtersToSave));
    } catch (error) {
      console.error("Error saving filters to localStorage:", error);
    }
  }, [
    storageKey,
    companyFilter,
    statusFilter,
    contractTypeFilter,
    liquidezStatusFilter,
    activationDateRange,
    creationDateRange,
    renovationDateRange,
    collectionDateRange,
    paymentDateRange,
    userFilter,
    typeFilter,
    providerFilter,
    excludeCompany,
    excludeUser,
  ]);

  // Auto-save filters to localStorage whenever they change
  useEffect(() => {
    // Only save after initial load is complete to avoid overwriting with empty values
    if (initialLoadComplete.current) {
      saveFiltersToStorage();
    }
  }, [
    companyFilter,
    statusFilter,
    contractTypeFilter,
    liquidezStatusFilter,
    activationDateRange,
    creationDateRange,
    renovationDateRange,
    collectionDateRange,
    paymentDateRange,
    userFilter,
    typeFilter,
    providerFilter,
    excludeCompany,
    excludeUser,
    saveFiltersToStorage,
  ]);

  // Only reset the filters in state and clear localStorage
  const resetFilters = useCallback(() => {
    setCompanyFilter(undefined);
    setStatusFilter(undefined);
    setContractTypeFilter(undefined);
    setFilterValue("");
    setLiquidezStatusFilter(undefined);
    setActivationDateRange(undefined);
    setCreationDateRange(undefined);
    setRenovationDateRange(undefined);
    setCollectionDateRange(undefined);
    setPaymentDateRange(undefined);
    setUserFilter(undefined);
    setTypeFilter(undefined);
    setProviderFilter(undefined);
    setExcludeCompany(false);
    setExcludeUser(false);

    // Clear localStorage when filters are reset
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

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
    typeFilter,
    providerFilter,
    setTypeFilter,
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
    saveFiltersToStorage,
    loadFiltersFromStorage,
    userFilter,
    setUserFilter,
    setProviderFilter,
    excludeCompany,
    setExcludeCompany,
    excludeUser,
    setExcludeUser,
  };
}
