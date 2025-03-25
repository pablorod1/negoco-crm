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
import { User, type TramiteRow } from "@/lib/core/types";
import { TableLayout } from "../../core/table/TableLayout";
import { TableContent } from "../../core/table/TableContent";
import { DataTablePagination } from "../../core/table/DataTablePagination";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import { useTramites } from "@/lib/contexts/TramitesContext";
import TramitesHeader from "./TableHeader";
import { useUser } from "@/lib/contexts/UserContext";
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
  const { userData } = useUser();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [tramites, setTramites] = useState<TramiteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const {
    filterValue,
    companyFilter,
    statusFilter,
    liquidezStatusFilter,
    contractTypeFilter,
    setFilterValue,
    setCompanyFilter,
    setStatusFilter,
    setContractTypeFilter,
    setLiquidezStatusFilter,
    resetFilters,
  } = useTableFilters(id || "");

  const { pagination, setPagination } = useTablePagination();

  const { setRefreshTramites } = useTramites();

  const fetchTramites = useCallback(async () => {
    setLoading(true);
    if (userData) {
      try {
        const res = await fetch(`/api/tramites/get/paginated-tramites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page: pagination.pageIndex || 1,
            rowsPerPage: pagination.pageSize,
            user_id: userData.id,
            user_role: userData.role,
            filterValue,
            companyFilter,
            statusFilter:
              title === "Trámites" ? statusFilter : ["Activo", "Baja"],
            liquidezStatusFilter,
            contractTypeFilter,
          }),
        });
        const { success, data, error } = await res.json();
        if (!success && error) {
          console.error("Error al obtener trámites:", error);
          return;
        }

        setTramites(data || []);
      } catch (error) {
        console.error("Error al obtener trámites:", error);
      } finally {
        setLoading(false);
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
    title,
  ]);

  // Fetch de datos
  useEffect(() => {
    setRefreshTramites(fetchTramites);
    fetchTramites();
  }, [fetchTramites, setRefreshTramites]);

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
      setFilterValue,
      setCompanyFilter,
      setStatusFilter,
      setLiquidezStatusFilter,
      setContractTypeFilter,
      resetFilters: handleResetFilters,
      userData: userData || ({} as User),
      totalTramites: tramites.length,
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
      tramites,
    ]
  );

  return (
    <div className="flex flex-col gap-4 bg-gray-50 w-full h-full">
      <TramitesHeader table={table} {...toolbarProps} />
      <TableLayout>
        <TableContent table={table} loading={loading} columns={columns} />
        <div className="mt-6">
          <DataTablePagination table={table} />
        </div>
      </TableLayout>
    </div>
  );
}
