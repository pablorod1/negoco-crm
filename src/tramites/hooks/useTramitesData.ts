import { useCallback, useEffect, useState } from "react";
import { useTramites } from "@/core/contexts/TramitesContext";
import { TramiteRow } from "@/tramites/types";
import { User } from "@/core/types";
import { DateRange } from "react-day-picker";

interface UseTramitesDataParams {
  userData: User | null;
  pageIndex: number;
  pageSize: number | string;
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
  isTramitesTable: boolean;
  isLiquidezTable: boolean;
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
  isTramitesTable,
  isLiquidezTable,
}: UseTramitesDataParams) {
  const [tramites, setTramites] = useState<TramiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTramites, setTotalTramites] = useState(0);

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
          typeof pageSize === "number"
            ? pageSize.toString()
            : pageSize === "Sin Límite"
              ? "400"
              : "400"
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

        if (isLiquidezTable && providerFilter && providerFilter.length > 0) {
          params.append("providerFilter", JSON.stringify(providerFilter));
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
      providerFilter,
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

  return {
    tramites,
    loading,
    totalTramites,
    fetchTramites,
  };
}
