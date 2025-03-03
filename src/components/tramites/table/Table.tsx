"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { User, type TramiteVM } from "@/lib/core/types";
import { getTramites } from "@/lib/libsql/data/tramites/getTramites";
import { TableLayout } from "./TableLayout";
import { TableContent } from "./TableContent";
import { DataTablePagination } from "./DataTablePagination";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTramites } from "@/contexts/TramitesContext";
import TramitesHeader from "./TableHeader";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  title: string;
}

export function DataTable<TData, TValue>({
  columns,
  title,
}: DataTableProps<TData, TValue>) {
  const params = useSearchParams();
  const id = params.get("id");
  const { userData, loading } = useUser();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [tramites, setTramites] = useState<TramiteVM[]>([]);
  const [loadedData, setLoadedData] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const {
    filterValue,
    companyFilter,
    statusFilter,
    liquidezStatusFilter,
    contractTypeFilter,
    selectedColumns,
    setFilterValue,
    setCompanyFilter,
    setStatusFilter,
    setContractTypeFilter,
    setLiquidezStatusFilter,
    resetFilters,
    setSelectedColumns,
  } = useTableFilters(id || "");

  const { pagination, setPagination } = useTablePagination();

  const { setRefreshTramites } = useTramites();

  const fetchTramites = useCallback(async () => {
    if (!loading && userData) {
      try {
        const data = await getTramites(
          pagination.pageIndex,
          pagination.pageSize,
          userData,
          filterValue,
          companyFilter,
          title === "Trámites" ? statusFilter : ["Activo", "Baja"],
          liquidezStatusFilter,
          contractTypeFilter
        );
        setTramites(data || []);
        setTimeout(() => setLoadedData(true), 1000);
      } catch (error) {
        console.error("Error al obtener trámites:", error);
      }
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    filterValue,
    companyFilter,
    statusFilter,
    liquidezStatusFilter,
    contractTypeFilter,
    userData,
    loading,
    title,
  ]);

  useEffect(() => {
    const cleanup = setRefreshTramites(fetchTramites);
    return () => cleanup();
  }, [fetchTramites, setRefreshTramites]);

  // Fetch de datos
  useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  const tableConfig = useMemo(
    () => ({
      data: tramites as TData[],
      columns,
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      onSortingChange: setSorting,
      onPaginationChange: setPagination,
      onColumnVisibilityChange: setColumnVisibility,
      state: {
        sorting,
        pagination,
        columnVisibility,
      },
    }),
    [tramites, columns, sorting, pagination, setPagination, columnVisibility]
  );

  const table = useReactTable(tableConfig);

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
      selectedColumns,
      setFilterValue,
      setCompanyFilter,
      setStatusFilter,
      setLiquidezStatusFilter,
      setContractTypeFilter,
      setSelectedColumns,
      resetFilters: handleResetFilters,
      userData: userData || ({} as User),
    }),
    [
      filterValue,
      title,
      companyFilter,
      statusFilter,
      liquidezStatusFilter,
      contractTypeFilter,
      selectedColumns,
      setFilterValue,
      setCompanyFilter,
      setStatusFilter,
      setLiquidezStatusFilter,
      setContractTypeFilter,
      handleResetFilters,
      setSelectedColumns,
      userData,
    ]
  );

  return (
    <div className="flex flex-col gap-4 bg-gray-50 w-full h-full">
      <TramitesHeader table={table} {...toolbarProps} />
      <TableLayout>
        <TableContent table={table} dataLoaded={loadedData} columns={columns} />
        <div className="mt-6">
          <DataTablePagination table={table} />
        </div>
      </TableLayout>
    </div>
  );
}
