"use client";

import React from "react";
import { useUser } from "@/lib/contexts/UserContext";
import {
  BackofficeView,
  ComercialView,
  DireccionView,
} from "./DashboardBentoGridViews";
import toast from "react-hot-toast";
import Hero from "./Hero";
import { showCustomToast } from "../core/CustomToast";
import { CheckCircle, CircleX } from "lucide-react";
import { User } from "@/lib/core/types";
import { Skeleton } from "../ui/skeleton";

export interface DashboardCardValue {
  total: number;
  value: number;
  prev_value: number;
  difference: number;
}

interface DashboardData {
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

export default function DashboardBentoGrid() {
  const { userData, getPlan } = useUser();
  const [dashboardData, setDashboardData] =
    React.useState<DashboardData>(initialDashboardData);
  const [loading, setLoading] = React.useState(true);
  const isFirstRender = React.useRef(true);

  const isBackOffice = userData?.role === "1";
  const isComercial = userData?.role === "2";
  const isDireccion = userData?.role === "admin";
  const fetchData = React.useCallback(async () => {
    if (!userData) return;
    try {
      const clientsRes = await fetch(`/api/tramites/get/clients-count`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: userData.id, role: userData.role }),
      });
      const activePendingRes = await fetch(
        `
        /api/tramites/get/active-pending`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: userData.role,
            id: userData.id,
          }),
        }
      );

      const comisionesRes = await fetch(
        `
        /api/tramites/get/comisiones-pendientes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: userData.id, role: userData.role }),
        }
      );

      const balanceRes = await fetch(
        `
          /api/tramites/get/monthly-comisiones
          `,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: userData.id, role: userData.role }),
        }
      );

      const comparativasRes = await fetch(
        `/api/comparativas/get/completed-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: userData.id, role: userData.role }),
        }
      );

      const [
        { data: clients },
        { data: active },
        { data: totalComisiones },
        { data: balance },
        { data: comparativas },
      ] = await Promise.all([
        clientsRes.json(),
        activePendingRes.json(),
        comisionesRes.json(),
        balanceRes.json(),
        comparativasRes.json(),
      ]);

      const totalBalance = balance.reduce(
        (acc: number, { total }: { total: number }) => acc + total,
        0
      );

      setDashboardData({
        clients,
        activeTramites: active,
        comisionesPendientes: totalComisiones,
        totalBalance,
        comparativas: comparativas,
      });

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
      console.error("Error fetching data:", error);
      setDashboardData(initialDashboardData);
    } finally {
      setLoading(false);
    }
  }, [userData]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData, userData]);

  const refreshData = async () => {
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
      console.error("Error refreshing data:", error);
      showCustomToast({
        title: "Error al actualizar los datos",
        message: "No se pudieron actualizar los datos",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };

  const commonProps = {
    userData: userData as User,
    loading,
    clients: dashboardData.clients,
    activeTramites: dashboardData.activeTramites,
    totalBalance: dashboardData.totalBalance,
    comparativas: dashboardData.comparativas,
    refreshData,
    getPlan,
  };

  return (
    <section className="flex flex-col gap-4 px-8 py-8">
      {loading ? (
        <Skeleton className="w-full h-72 rounded-xl bg-primary-500" />
      ) : (
        <Hero {...commonProps} />
      )}
      {isComercial ? (
        <ComercialView {...commonProps} />
      ) : isBackOffice ? (
        <BackofficeView {...commonProps} />
      ) : isDireccion ? (
        <DireccionView {...commonProps} />
      ) : null}
    </section>
  );
}
