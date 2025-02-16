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
} from "@tanstack/react-table";
import { type TramiteVM } from "@/lib/types";
import { getTramites } from "@/lib/libsql/data/tramites/getTramites";
import { TableLayout } from "./TableLayout";
import { TableContent } from "./TableContent";
import { DataTablePagination } from "./data-table-pagination";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTramites } from "@/contexts/TramitesContext";
import TramitesHeader from "../TramitesHeader";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
}

export function DataTable<TData, TValue>({
  columns,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [tramites, setTramites] = useState<TramiteVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    filterValue,
    companyFilter,
    statusFilter,
    contractTypeFilter,
    setFilterValue,
    setCompanyFilter,
    setStatusFilter,
    setContractTypeFilter,
    resetFilters,
  } = useTableFilters();

  const { pagination, setPagination } = useTablePagination();

  const { setRefreshTramites } = useTramites();

  const fetchTramites = useCallback(async () => {
    if (!isInitialized) return;

    setLoading(true);
    try {
      const data = await getTramites(
        pagination.pageIndex,
        pagination.pageSize,
        filterValue,
        companyFilter,
        statusFilter,
        contractTypeFilter
      );
      setTramites(data || []);
    } catch (error) {
      console.error("Error al obtener trámites:", error);
    } finally {
      setLoading(false);
    }
  }, [
    isInitialized,
    pagination.pageIndex,
    pagination.pageSize,
    filterValue,
    companyFilter,
    statusFilter,
    contractTypeFilter,
  ]);

  // Inicialización
  useEffect(() => {
    setIsInitialized(true);
    return () => setIsInitialized(false);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      const cleanup = setRefreshTramites(fetchTramites);
      return () => cleanup();
    }
  }, [fetchTramites, setRefreshTramites, isInitialized]);

  // Fetch de datos
  useEffect(() => {
    if (isInitialized) {
      fetchTramites();
    }
  }, [fetchTramites, isInitialized]);

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
      state: {
        sorting,
        pagination,
      },
    }),
    [tramites, columns, sorting, pagination, setPagination]
  );

  const table = useReactTable(tableConfig);

  const toolbarProps = useMemo(
    () => ({
      filterValue,
      companyFilter,
      statusFilter,
      contractTypeFilter,
      setFilterValue,
      setCompanyFilter,
      setStatusFilter,
      setContractTypeFilter,
      resetFilters,
    }),
    [
      filterValue,
      companyFilter,
      statusFilter,
      contractTypeFilter,
      setFilterValue,
      setCompanyFilter,
      setStatusFilter,
      setContractTypeFilter,
      resetFilters,
    ]
  );

  if (!isInitialized) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 bg-gray-50 w-full h-full">
      <TramitesHeader {...toolbarProps} />
      <TableLayout>
        <TableContent table={table} loading={loading} columns={columns} />
        <div className="mt-6">
          <DataTablePagination table={table} />
        </div>
      </TableLayout>
    </div>
  );
}
