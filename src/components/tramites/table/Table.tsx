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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  title: string;
}

export function DataTable<TData, TValue>({
  columns,
  title,
}: DataTableProps<TData, TValue>) {
  const { userData } = useUser();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [tramites, setTramites] = useState<TramiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pageSize, setPageSize] = useState(15);
  const [pageIndex, setPageIndex] = useState(1);
  const [totalTramites, setTotalTramites] = useState(0);

  const isTramitesTable = title === "Trámites";
  const isLiquidezTable = title === "Liquidez";

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
  } = useTableFilters(isLiquidezTable ? "liquidez" : "tramites");

  const { setRefreshTramites } = useTramites();

  const fetchTramites = useCallback(
    async (isMounted = true) => {
      if (!userData) return;
      try {
        setLoading(true);
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
            statusFilter: isTramitesTable
              ? statusFilter
              : isLiquidezTable && statusFilter
                ? statusFilter
                : ["Activo", "Baja"],
            liquidezStatusFilter,
            contractTypeFilter,
            activationDateRange,
            creationDateRange,
            renovationDateRange,
            collectionDateRange: isLiquidezTable
              ? collectionDateRange
              : undefined,
            paymentDateRange: isLiquidezTable ? paymentDateRange : undefined,
            userFilter,
          }),
        });
        const { success, data, error, total } = await res.json();
        if (!success && error) {
          console.error("Error al obtener trámites:", error);
          if (isMounted) {
            setTramites([]);
            setTotalTramites(0);
          }
          return;
        }

        if (isMounted) {
          setTramites(data || []);
          setTotalTramites(total || 0);
        }
      } catch (error) {
        console.error("Error al obtener trámites:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    },
    [
      pageIndex,
      pageSize,
      filterValue,
      companyFilter,
      statusFilter,
      liquidezStatusFilter,
      contractTypeFilter,
      userData,
      isTramitesTable,
      isLiquidezTable,
      activationDateRange,
      creationDateRange,
      renovationDateRange,
      collectionDateRange,
      paymentDateRange,
      userFilter,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    // Define a refresh function that will be exposed through context
    const refresh = async () => {
      if (!isMounted) return;
      await fetchTramites(true);
    };

    // Set the refresh function in context
    setRefreshTramites(refresh);

    // Initial fetch
    fetchTramites(isMounted);

    return () => {
      isMounted = false;
    };
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
        />
      </TableLayout>
    </div>
  );
}
