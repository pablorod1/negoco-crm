"use client";

import { useCallback, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { User } from "@/core/types";
import { useTableFilters } from "@/core/hooks/use-table-filters";
import { useTablePagination } from "@/core/hooks/use-table-pagination";
import TramitesHeader from "./TableHeader";
import { useUser } from "@/core/contexts/UserContext";
import { TableContent } from "@/core/components/table/TableContent";
import { useTramitesData } from "@/tramites/hooks/useTramitesData";
import { useTableConfig } from "@/tramites/hooks/useTableConfig";
import { useContractsExport } from "@/tramites/hooks/useContractsExport";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  title: string;
}

export function DataTable<TData, TValue>({
  columns,
  title,
}: DataTableProps<TData, TValue>) {
  const { userData } = useUser();

  const isTramitesTable = title === "Trámites";
  const isLiquidezTable = title === "Liquidez";

  const tableId = isLiquidezTable ? "liquidez" : "tramites";
  const { pageIndex, pageSize, setPageIndex, setPageSize, isInitialized } =
    useTablePagination(tableId);

  const {
    filterValue,
    companyFilter,
    statusFilter,
    liquidezStatusFilter,
    contractTypeFilter,
    activationDateRange,
    creationDateRange,
    renovationDateRange,
    collectionDateRange,
    paymentDateRange,
    setFilterValue,
    setCompanyFilter,
    setStatusFilter,
    setContractTypeFilter,
    setLiquidezStatusFilter,
    resetFilters,
    setActivationDateRange,
    setCreationDateRange,
    setRenovationDateRange,
    setCollectionDateRange,
    setPaymentDateRange,
    saveFiltersToStorage,
    userFilter,
    setUserFilter,
    providerFilter,
    setProviderFilter,
    excludeCompany,
    setExcludeCompany,
    excludeUser,
    setExcludeUser,
  } = useTableFilters(isLiquidezTable ? "liquidez" : "tramites");

  const { tramites, loading, totalTramites, filterBundle } = useTramitesData({
    userData,
    pageIndex,
    pageSize,
    filterValue,
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
    excludeCompany,
    excludeUser,
    isTramitesTable,
    isLiquidezTable,
    paginationReady: isInitialized,
  });

  const { table } = useTableConfig({
    data: tramites as TData[],
    columns,
  });

  // Exports every filtered tramite, not just the page on screen.
  const serverExport = useContractsExport(filterBundle);

  // Función personalizada para manejar el reseteo de filtros
  const handleResetFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const toolbarProps = useMemo(
    () => ({
      filterValue,
      title,
      companyFilter,
      statusFilter,
      liquidezStatusFilter,
      contractTypeFilter,
      setFilterValue,
      setCompanyFilter,
      setStatusFilter,
      setLiquidezStatusFilter,
      setContractTypeFilter,
      resetFilters: handleResetFilters,
      userData: userData || ({} as User),
      totalTramites,
      setActivationDateRange,
      setCreationDateRange,
      setRenovationDateRange,
      activationDateRange,
      creationDateRange,
      renovationDateRange,
      collectionDateRange,
      paymentDateRange,
      setCollectionDateRange,
      setPaymentDateRange,
      saveFiltersToStorage,
      userFilter,
      setUserFilter,
      providerFilter,
      setProviderFilter,
      excludeCompany,
      setExcludeCompany,
      excludeUser,
      setExcludeUser,
      serverExport,
    }),
    [
      filterValue,
      title,
      companyFilter,
      statusFilter,
      liquidezStatusFilter,
      contractTypeFilter,
      setFilterValue,
      setCompanyFilter,
      setStatusFilter,
      setLiquidezStatusFilter,
      setContractTypeFilter,
      handleResetFilters,
      userData,
      activationDateRange,
      creationDateRange,
      renovationDateRange,
      totalTramites,
      setActivationDateRange,
      setCreationDateRange,
      setRenovationDateRange,
      collectionDateRange,
      paymentDateRange,
      setCollectionDateRange,
      setPaymentDateRange,
      saveFiltersToStorage,
      userFilter,
      setUserFilter,
      providerFilter,
      setProviderFilter,
      excludeCompany,
      setExcludeCompany,
      excludeUser,
      setExcludeUser,
      serverExport,
    ],
  );

  return (
    <div className="flex flex-col gap-2 w-full h-full min-w-0 px-2">
      <TramitesHeader table={table} {...toolbarProps} />
      <div className="bg-white rounded-4xl squircle border border-gray-100 shadow-sm overflow-hidden">
        <TableContent
          setPageSize={setPageSize}
          total={totalTramites}
          rowsPerPage={pageSize}
          setPageIndex={setPageIndex}
          pageIndex={pageIndex}
          table={table}
          loading={loading}
          columns={columns}
        />
      </div>
    </div>
  );
}
