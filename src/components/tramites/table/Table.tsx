"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { User, type TramiteRow } from "@/lib/core/types";
import { TableLayout } from "../../core/table/TableLayout";
import { TableContent } from "../../core/table/TableContent";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
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
  const [loading, setLoading] = useState(true);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pageSize, setPageSize] = useState(15);
  const [pageIndex, setPageIndex] = useState(1);
  const [totalTramites, setTotalTramites] = useState(0);

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
    dateRange,
    setDateRange,
  } = useTableFilters(id || "");

  const { setRefreshTramites } = useTramites();

  const fetchTramites = useCallback(async () => {
    if (userData) {
      try {
        const res = await fetch(`/api/tramites/get/paginated-tramites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page: pageIndex,
            rowsPerPage: pageSize,
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
        const { success, data, error, total } = await res.json();
        if (!success && error) {
          console.error("Error al obtener trámites:", error);
          return;
        }

        setTramites(data || []);
        setTotalTramites(total || 0);
      } catch (error) {
        console.error("Error al obtener trámites:", error);
      } finally {
        setLoading(false);
      }
    }
  }, [
    pageIndex,
    pageSize,
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
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      onSortingChange: setSorting,
      onColumnVisibilityChange: setColumnVisibility,
      state: {
        sorting,
        columnVisibility,
      },
    }),
    [tramites, columns, sorting, columnVisibility]
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
      totalTramites,
      dateRange,
      setDateRange,
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
      dateRange,
      setDateRange,
      totalTramites,
    ]
  );

  return (
    <div className="flex flex-col gap-4 bg-gray-50 w-full h-full">
      <TramitesHeader table={table} {...toolbarProps} />
      <TableLayout>
        <TableContent
          setPageSize={setPageSize}
          total={totalTramites}
          rowsPerPage={pageSize}
          setPageIndex={setPageIndex}
          pageIndex={pageIndex}
          table={table}
          loading={loading}
          columns={columns}
          userData={userData as User}
        />
      </TableLayout>
    </div>
  );
}
