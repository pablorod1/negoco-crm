import { useState, useCallback, useRef } from "react";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";
import { CheckCircle, CircleX } from "lucide-react";
import {
  DASHBOARD_API_ENDPOINTS,
  API_HEADERS,
} from "@/dashboard/utils/dashboardApi";
import {
  createBaseRequestBody,
  handleApiError,
} from "@/dashboard/utils/dashboardUtils";
import toast from "react-hot-toast";

export interface DashboardCardValue {
  total: number;
  value: number;
  prev_value: number;
  difference: number;
}

export interface DashboardData {
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  comisionesPendientes: number;
  totalBalance: number;
  comparativas: DashboardCardValue;
}

const initialDashboardData: DashboardData = {
  clients: { total: 0, value: 0, prev_value: 0, difference: 0 },
  activeTramites: { total: 0, value: 0, prev_value: 0, difference: 0 },
  comisionesPendientes: 0,
  totalBalance: 0,
  comparativas: { total: 0, value: 0, prev_value: 0, difference: 0 },
};

export const useDashboardData = (userData: User | null) => {
  const [dashboardData, setDashboardData] =
    useState<DashboardData>(initialDashboardData);
  const [loading, setLoading] = useState(true);
  const isFirstRender = useRef(true);

  const fetchData = useCallback(async () => {
    if (!userData) return;

    try {
      const requestBody = createBaseRequestBody(userData);

      const response = await fetch(DASHBOARD_API_ENDPOINTS.HERO_DATA, {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data } = await response.json();

      setDashboardData(data);

      // Show notification toast only on first render
      if (
        isFirstRender.current &&
        userData.notifications &&
        userData.notifications > 0
      ) {
        toast(`Tienes ${userData.notifications} notificaciones pendientes`, {
          icon: "🔔",
          duration: 3000,
          position: "top-center",
        });
        isFirstRender.current = false;
      }
    } catch (error) {
      handleApiError(error, "fetching dashboard data");
      setDashboardData(initialDashboardData);
    } finally {
      setLoading(false);
    }
  }, [userData]);

  const refreshData = useCallback(async () => {
    try {
      await fetchData();
      showCustomToast({
        title: "Datos actualizados",
        message: "Los datos se han actualizado correctamente",
        icon: CheckCircle,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
    } catch (error) {
      handleApiError(error, "refreshing data");
      showCustomToast({
        title: "Error al actualizar los datos",
        message: "No se pudieron actualizar los datos",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  }, [fetchData]);

  return {
    dashboardData,
    loading,
    fetchData,
    refreshData,
  };
};
