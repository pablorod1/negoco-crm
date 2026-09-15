import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTramites } from "@/core/contexts/TramitesContext";
import { TramiteRow } from "@/tramites/types";
import { User } from "@/core/types";
import { DateRange } from "react-day-picker";
import {
  buildContractsQueryParams,
  type ContractsQueryFilters,
} from "@/tramites/utils/buildContractsQueryParams";

interface UseTramitesDataParams {
  userData: User | null;
  pageIndex: number;
  pageSize: number;
  filterValue: string;
  companyFilter: string[] | undefined;
  statusFilter: string[] | undefined;
  liquidezStatusFilter: string[] | undefined;
  contractTypeFilter: string[] | undefined;
  activationDateRange: DateRange | undefined;
  creationDateRange: DateRange | undefined;
  renovationDateRange: DateRange | undefined;
  collectionDateRange: DateRange | undefined;
  paymentDateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  providerFilter: string[] | undefined;
  excludeCompany: boolean;
  excludeUser: boolean;
  isTramitesTable: boolean;
  isLiquidezTable: boolean;
  paginationReady: boolean;
}

export function useTramitesData({
  userData,
  pageIndex,
  pageSize,
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
  userFilter,
  providerFilter,
  excludeCompany,
  excludeUser,
  isTramitesTable,
  isLiquidezTable,
  paginationReady,
}: UseTramitesDataParams) {
  const [tramites, setTramites] = useState<TramiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTramites, setTotalTramites] = useState(0);
  const latestRequestId = useRef(0);

  const { setRefreshTramites } = useTramites();

  // Single source of truth for "what is currently filtered", consumed both by
  // the paginated fetch below and by the Excel export.
  const filterBundle = useMemo<ContractsQueryFilters>(
    () => ({
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
      userFilter,
      providerFilter,
      excludeCompany,
      excludeUser,
      isTramitesTable,
      isLiquidezTable,
    }),
    [
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
      userFilter,
      providerFilter,
      excludeCompany,
      excludeUser,
      isTramitesTable,
      isLiquidezTable,
    ],
  );

  const fetchTramites = useCallback(
    async (signal?: AbortSignal) => {
      if (!userData || !paginationReady) return;
      const requestId = ++latestRequestId.current;
      const isCurrentRequest = () =>
        requestId === latestRequestId.current && !signal?.aborted;

      try {
        setLoading(true);

        // Build query parameters (shared with the Excel export)
        const params = buildContractsQueryParams(filterBundle);
        params.append("page", pageIndex.toString());
        params.append("rowsPerPage", pageSize.toString());
        params.append("user_id", userData.id);
        params.append("user_role", userData.role);

        const res = await fetch(`/api/v2/contracts?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal,
        });

        const { success, data, error, total } = await res.json();
        if (!success && error) {
          console.error("Error al obtener trámites:", error);
          if (isCurrentRequest()) {
            setTramites([]);
            setTotalTramites(0);
          }
          return;
        }

        if (isCurrentRequest()) {
          setTramites(data || []);
          setTotalTramites(total || 0);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Error al obtener trámites:", error);
      } finally {
        if (isCurrentRequest()) setLoading(false);
      }
    },
    [pageIndex, pageSize, userData, filterBundle, paginationReady]
  );

  useEffect(() => {
    if (!paginationReady) return;

    const controller = new AbortController();

    // Define a refresh function that will be exposed through context
    const refresh = async () => {
      await fetchTramites();
    };

    // Set the refresh function in context
    const unregisterRefresh = setRefreshTramites(refresh);

    // Initial fetch
    void fetchTramites(controller.signal);

    return () => {
      controller.abort();
      unregisterRefresh();
    };
  }, [fetchTramites, paginationReady, setRefreshTramites]);

  return {
    tramites,
    loading,
    totalTramites,
    fetchTramites,
    filterBundle,
  };
}
