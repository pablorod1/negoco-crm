"use client";
import { DataTablePagination } from "@/components/core/table/DataTablePagination";
import { TableLayout } from "@/components/core/table/TableLayout";
import { ComparativaVM, User } from "@/lib/core/types";
import { useTablePagination } from "@/lib/hooks/use-table-pagination";
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import ComparativasHeader from "./ComparativasHeader";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
import { useSearchParams } from "next/navigation";
import { TableContent } from "@/components/core/table/TableContent";
import { useUser } from "@/lib/contexts/UserContext";
import { useComparativas } from "@/lib/contexts/ComparativasContext";

interface Props<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
}

export default function ComparativasTable<TData, TValue>({
  columns,
}: Props<TData, TValue>) {
  const { userData } = useUser();
  const { setRefreshComparativas } = useComparativas();
  const params = useSearchParams();
  const id = params.get("id");
  const [comparativas, setComparativas] = useState<ComparativaVM[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [loading, setLoading] = useState(false);

  const {
    filterValue,
    statusFilter,
    setFilterValue,
    setStatusFilter,
    resetFilters,
    dateRange,
    setDateRange,
  } = useTableFilters(id || "");

  const { pagination, setPagination } = useTablePagination();

  const fetchComparativas = useCallback(async () => {
    setLoading(true);
    if (userData) {
      try {
        const res = await fetch(
          `/api/comparativas/get/paginated-comparativas`,
          {
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
              statusFilter,
              dateRange,
            }),
          }
        );

        const { success, data, error } = await res.json();
        if (!success) {
          console.error("Error al obtener comparativas:", error);
          setComparativas([]);
          setLoading(false);
          return;
        }

        if (data.length === 0) {
          setComparativas([]);
          setLoading(false);
          return;
        }
        setComparativas(data);
        setLoading(false);
      } catch (error) {
        console.error("Error al obtener comparativas:", error);
      }
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    filterValue,
    statusFilter,
    userData,
    dateRange,
  ]);

  // Consolidated useEffect for data fetching and refresh
  useEffect(() => {
    const cleanup = setRefreshComparativas(fetchComparativas);
    fetchComparativas(); // Initial fetch
    return () => cleanup();
  }, [
    fetchComparativas,
    setRefreshComparativas,
    pagination.pageIndex,
    pagination.pageSize,
    filterValue,
    statusFilter,
  ]);

  const tableConfig = useMemo(
    () => ({
      data: comparativas as TData[],
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
    [
      comparativas,
      columns,
      sorting,
      pagination,
      setPagination,
      columnVisibility,
    ]
  );

  const handleResetFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const toolbarProps = useMemo(
    () => ({
      filterValue,
      statusFilter,
      setFilterValue,
      setStatusFilter,
      resetFilters: handleResetFilters,
      totalComparativas: comparativas.length,
      userData: userData as User,
      dateRange,
      setDateRange,
    }),
    [
      filterValue,
      statusFilter,
      setFilterValue,
      setStatusFilter,
      handleResetFilters,
      comparativas,
      userData,
      dateRange,
      setDateRange,
    ]
  );

  const table = useReactTable(tableConfig);
  return (
    <div className="flex flex-col gap-4 bg-gray-50 w-full h-full">
      <ComparativasHeader table={table} {...toolbarProps} />
      <TableLayout>
        <TableContent
          table={table}
          loading={loading}
          columns={columns}
          userData={userData as User}
        />
        <div className="mt-6">
          <DataTablePagination table={table} />
        </div>
      </TableLayout>
    </div>
  );
}
