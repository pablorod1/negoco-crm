"use client";
import { TableLayout } from "@/components/core/table/TableLayout";
import { FotovoltaicaVM, User } from "@/lib/core/types";
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
import { useTableFilters } from "@/lib/hooks/use-table-filters";
import { TableContent } from "@/components/core/table/TableContent";
import { useUser } from "@/lib/contexts/UserContext";
import { useFotovoltaicas } from "@/lib/contexts/FotovoltaicasContext";
import FotovoltaicasHeader from "./FotovoltaicasHeader";

interface Props<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
}

export default function FotovoltaicasTable<TData, TValue>({
  columns,
}: Props<TData, TValue>) {
  const { userData } = useUser();
  const { setRefreshFotovoltaicas } = useFotovoltaicas();
  const [fotovoltaicas, setFotovoltaicas] = useState<FotovoltaicaVM[]>([]);
  const [totalFotovoltaicas, setTotalFotovoltaicas] = useState(0);
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
    activationDateRange,
    setCreationDateRange,
    saveFiltersToStorage, // Extract this from the hook
    userFilter,
    setUserFilter,
    typeFilter,
    setTypeFilter,
    setActivationDateRange,
  } = useTableFilters("fotovoltaicas");

  const fetchFotovoltaicas = useCallback(
    async (isMounted = true) => {
      setLoading(true);
      if (userData) {
        try {
          const res = await fetch(
            `/api/fotovoltaica/get/paginated-fotovoltaicas`,
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
                creationDateRange,
                activationDateRange,
                userFilter,
                typeFilter,
              }),
            }
          );

          const { success, data, error, total } = await res.json();
          if (!success) {
            if (isMounted) {
              setFotovoltaicas([]);
              setLoading(false);
            }
            console.error(
              "Error al obtener solicitudes de placas solares:",
              error
            );
            return;
          }

          if (isMounted) {
            setFotovoltaicas(data || []);
            setTotalFotovoltaicas(total || 0);
            setLoading(false);
          }
        } catch (error) {
          if (isMounted) {
            setLoading(false);
          }
          console.error(
            "Error al obtener solicitudes de placas solares:",
            error
          );
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
      activationDateRange,
      typeFilter,
    ]
  );

  // Consolidated useEffect for data fetching and refresh
  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      if (!isMounted) return;
      await fetchFotovoltaicas(true);
    };

    setRefreshFotovoltaicas(refresh);

    // Initial fetch
    fetchFotovoltaicas(isMounted);

    return () => {
      isMounted = false;
    };
  }, [fetchFotovoltaicas, setRefreshFotovoltaicas]);

  const tableConfig = useMemo(
    () => ({
      data: fotovoltaicas as TData[],
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
    [fotovoltaicas, columns, sorting, columnVisibility]
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
      totalFotovoltaicas,
      userData: userData as User,
      creationDateRange,
      setCreationDateRange,
      activationDateRange,
      setActivationDateRange,
      userFilter,
      setUserFilter,
      typeFilter,
      setTypeFilter,
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
      totalFotovoltaicas,
      userFilter,
      setUserFilter,
      typeFilter,
      setTypeFilter,
      activationDateRange,
      setActivationDateRange,
    ]
  );

  const table = useReactTable(tableConfig);
  return (
    <div className="flex flex-col gap-4 bg-gray-50 w-full h-full">
      <FotovoltaicasHeader table={table} {...toolbarProps} />
      <TableLayout>
        <TableContent
          setPageIndex={setPageIndex}
          table={table}
          loading={loading}
          columns={columns}
          rowsPerPage={pageSize}
          pageIndex={pageIndex}
          total={totalFotovoltaicas}
          setPageSize={setPageSize}
        />
      </TableLayout>
    </div>
  );
}
