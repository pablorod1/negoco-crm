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
import { User } from "@/core/types";
import { useTableFilters } from "@/core/hooks/use-table-filters";
import { useTramites } from "@/core/contexts/TramitesContext";
import TramitesHeader from "./TableHeader";
import { useUser } from "@/core/contexts/UserContext";
import { TableLayout } from "@/core/components/table/TableLayout";
import { TableContent } from "@/core/components/table/TableContent";
import { TramiteRow } from "@/tramites/types";

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
  const [pageSize, setPageSize] = useState<number | string>(15);
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

        // Build query parameters
        const params = new URLSearchParams();
        params.append("page", pageIndex.toString());
        params.append(
          "rowsPerPage",
          typeof pageSize === "number" ? pageSize.toString() : "Sin Límite"
        );
        params.append("user_id", userData.id);
        params.append("user_role", userData.role);

        if (filterValue) params.append("filterValue", filterValue);
        if (companyFilter && companyFilter.length > 0) {
          params.append("companyFilter", JSON.stringify(companyFilter));
        }

        const statusToSend = isTramitesTable
          ? statusFilter
          : isLiquidezTable && statusFilter
            ? statusFilter
            : ["Activo", "Baja"];
        if (statusToSend && statusToSend.length > 0) {
          params.append("statusFilter", JSON.stringify(statusToSend));
        }

        if (liquidezStatusFilter && liquidezStatusFilter.length > 0) {
          params.append(
            "liquidezStatusFilter",
            JSON.stringify(liquidezStatusFilter)
          );
        }
        if (contractTypeFilter && contractTypeFilter.length > 0) {
          params.append(
            "contractTypeFilter",
            JSON.stringify(contractTypeFilter)
          );
        }
        if (activationDateRange) {
          params.append(
            "activationDateRange",
            JSON.stringify(activationDateRange)
          );
        }
        if (creationDateRange) {
          params.append("creationDateRange", JSON.stringify(creationDateRange));
        }
        if (renovationDateRange) {
          params.append(
            "renovationDateRange",
            JSON.stringify(renovationDateRange)
          );
        }
        if (isLiquidezTable && collectionDateRange) {
          params.append(
            "collectionDateRange",
            JSON.stringify(collectionDateRange)
          );
        }
        if (isLiquidezTable && paymentDateRange) {
          params.append("paymentDateRange", JSON.stringify(paymentDateRange));
        }
        if (userFilter && userFilter.length > 0) {
          params.append("userFilter", JSON.stringify(userFilter));
        }

        const res = await fetch(`/api/v2/contracts?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
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
