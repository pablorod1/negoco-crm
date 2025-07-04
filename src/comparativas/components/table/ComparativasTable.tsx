"use client";
import { TableLayout } from "@/core/components/table/TableLayout";
import { User } from "@/core/types";
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
import { useTableFilters } from "@/core/hooks/use-table-filters";
import { TableContent } from "@/core/components/table/TableContent";
import { useUser } from "@/core/contexts/UserContext";
import { useComparativas } from "@/core/contexts/ComparativasContext";
import { ComparativaVM } from "@/comparativas/types";

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
  const [pageSize, setPageSize] = useState<string | number>(15);

  const {
    filterValue,
    statusFilter,
    setFilterValue,
    setStatusFilter,
    resetFilters,
    creationDateRange,
    setCreationDateRange,
    saveFiltersToStorage, // Extract this from the hook
    userFilter,
    setUserFilter,
  } = useTableFilters("comparativas");

  const fetchComparativas = useCallback(
    async (isMounted = true) => {
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
                rowsPerPage:
                  typeof pageSize === "number" ? pageSize : "Sin Límite",
                user_id: userData.id,
                user_role: userData.role,
                filterValue,
                statusFilter,
                dateRange: creationDateRange,
                userFilter,
              }),
            }
          );

          const { success, data, error, total } = await res.json();
          if (!success) {
            if (isMounted) {
              setComparativas([]);
              setLoading(false);
            }
            console.error("Error al obtener comparativas:", error);
            return;
          }

          if (isMounted) {
            setComparativas(data || []);
            setTotalComparativas(total || 0);
            setLoading(false);
          }
        } catch (error) {
          if (isMounted) {
            setLoading(false);
          }
          console.error("Error al obtener comparativas:", error);
        }
      }
    },
    [
      pageIndex,
      pageSize,
      filterValue,
      statusFilter,
      userData,
      creationDateRange,
      userFilter,
    ]
  );

  // Consolidated useEffect for data fetching and refresh
  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      if (!isMounted) return;
      await fetchComparativas(true);
    };

    setRefreshComparativas(refresh);

    // Initial fetch
    fetchComparativas(isMounted);

    return () => {
      isMounted = false;
    };
  }, [fetchComparativas, setRefreshComparativas]);

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
      userFilter,
      setUserFilter,
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
      userFilter,
      setUserFilter,
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
          rowsPerPage={pageSize}
          pageIndex={pageIndex}
          total={totalComparativas}
          setPageSize={setPageSize}
        />
      </TableLayout>
    </div>
  );
}
