"use client";
import { TableLayout } from "@/components/core/table/TableLayout";
import { ComparativaVM, User } from "@/lib/core/types";
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import ComparativasHeader from "./ComparativasHeader";
import { useTableFilters } from "@/lib/hooks/use-table-filters";
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
  const [comparativas, setComparativas] = useState<ComparativaVM[]>([]);
  const [totalComparativas, setTotalComparativas] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const {
    filterValue,
    statusFilter,
    setFilterValue,
    setStatusFilter,
    resetFilters,
    creationDateRange,
    setCreationDateRange,
    saveFiltersToStorage, // Extract this from the hook
  } = useTableFilters("comparativas");

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
              page: pageIndex,
              rowsPerPage: pageSize,
              user_id: userData.id,
              user_role: userData.role,
              filterValue,
              statusFilter,
              dateRange: creationDateRange,
            }),
          }
        );

        const { success, data, error, total } = await res.json();
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
        setTotalComparativas(total);
        setLoading(false);
      } catch (error) {
        console.error("Error al obtener comparativas:", error);
      }
    }
  }, [
    pageIndex,
    pageSize,
    filterValue,
    statusFilter,
    userData,
    creationDateRange,
  ]);

  // Consolidated useEffect for data fetching and refresh
  useEffect(() => {
    const cleanup = setRefreshComparativas(fetchComparativas);
    fetchComparativas(); // Initial fetch
    return () => cleanup();
  }, [
    fetchComparativas,
    setRefreshComparativas,
    pageIndex,
    pageSize,
    filterValue,
    statusFilter,
  ]);

  const tableConfig = useMemo(
    () => ({
      data: comparativas as TData[],
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
    [comparativas, columns, sorting, columnVisibility]
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
      saveFiltersToStorage, // Pass this to the header component
      totalComparativas,
      userData: userData as User,
      dateRange: creationDateRange,
      setDateRange: setCreationDateRange,
    }),
    [
      filterValue,
      statusFilter,
      setFilterValue,
      setStatusFilter,
      handleResetFilters,
      saveFiltersToStorage, // Add this to dependencies
      userData,
      creationDateRange,
      setCreationDateRange,
      totalComparativas,
    ]
  );

  const table = useReactTable(tableConfig);
  return (
    <div className="flex flex-col gap-4 bg-gray-50 w-full h-full">
      <ComparativasHeader table={table} {...toolbarProps} />
      <TableLayout>
        <TableContent
          setPageIndex={setPageIndex}
          table={table}
          loading={loading}
          columns={columns}
          userData={userData as User}
          rowsPerPage={pageSize}
          pageIndex={pageIndex}
          total={totalComparativas}
          setPageSize={setPageSize}
        />
      </TableLayout>
    </div>
  );
}
