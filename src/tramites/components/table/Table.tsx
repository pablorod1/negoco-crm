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
  const { pageIndex, pageSize, setPageIndex, setPageSize } =
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
  } = useTableFilters(isLiquidezTable ? "liquidez" : "tramites");

  const { tramites, loading, totalTramites } = useTramitesData({
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
    isTramitesTable,
    isLiquidezTable,
  });

  const { table } = useTableConfig({
    data: tramites as TData[],
    columns,
  });

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
    ]
  );

  return (
    <div className="flex flex-col gap-2 w-full h-full">
      <TramitesHeader table={table} {...toolbarProps} />
      <div className="bg-white rounded-4xl border border-gray-100 shadow-sm overflow-hidden">
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
