"use client";
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
import { useTablePagination } from "@/core/hooks/use-table-pagination";
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

  const { pageIndex, pageSize, setPageIndex, setPageSize } =
    useTablePagination("comparativas");

  const {
    filterValue,
    statusFilter,
    setFilterValue,
    setStatusFilter,
    resetFilters,
    creationDateRange,
    setCreationDateRange,
    saveFiltersToStorage,
    userFilter,
    setUserFilter,
    companyFilter,
    setCompanyFilter,
  } = useTableFilters("comparativas");

  const fetchComparativas = useCallback(
    async (isMounted = true) => {
      setLoading(true);
      if (userData) {
        try {
          // Build query params for the new GET endpoint contract
          const params = new URLSearchParams();
          params.set("page", String(pageIndex));
          params.set(
            "rowsPerPage",
            typeof pageSize === "number"
              ? String(pageSize)
              : pageSize === "Sin Límite"
                ? "200"
                : "200",
          );
          params.set("user_id", userData.id);
          params.set("user_role", userData.role);
          if (filterValue && filterValue.trim().length > 0) {
            params.set("filterValue", filterValue.trim());
          }
          if (statusFilter && statusFilter.length > 0) {
            params.set("statusFilter", JSON.stringify(statusFilter));
          }
          if (
            creationDateRange &&
            creationDateRange.from &&
            creationDateRange.to
          ) {
            params.set("dateRange", JSON.stringify(creationDateRange));
          }
          if (userFilter && userFilter.length > 0) {
            params.set("userFilter", JSON.stringify(userFilter));
          }

          if (companyFilter && companyFilter.length > 0) {
            params.set("companyFilter", JSON.stringify(companyFilter));
          }

          const url = `/api/v2/comparisons?${params.toString()}`;
          const res = await fetch(url, { method: "GET" });

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
      companyFilter,
    ],
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
    [comparativas, columns, sorting, columnVisibility],
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
      saveFiltersToStorage,
      totalComparativas,
      userData: userData as User,
      dateRange: creationDateRange,
      setDateRange: setCreationDateRange,
      userFilter,
      setUserFilter,
      companyFilter,
      setCompanyFilter,
    }),
    [
      filterValue,
      statusFilter,
      setFilterValue,
      setStatusFilter,
      handleResetFilters,
      saveFiltersToStorage,
      userData,
      creationDateRange,
      setCreationDateRange,
      totalComparativas,
      userFilter,
      setUserFilter,
      companyFilter,
      setCompanyFilter,
    ],
  );

  const table = useReactTable(tableConfig);

  return (
    <div className="flex flex-col gap-2 w-full h-full min-w-0">
      <ComparativasHeader table={table} {...toolbarProps} />
      <div className="bg-white rounded-4xl border border-gray-100 shadow-sm overflow-hidden">
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
      </div>
    </div>
  );
}
