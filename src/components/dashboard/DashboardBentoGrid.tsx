"use client";

import React from "react";
import { useUser } from "@/lib/contexts/UserContext";
import {
  BackofficeView,
  ComercialView,
  DireccionView,
} from "./DashboardBentoGridViews";
import { Spinner } from "@heroui/spinner";
import toast from "react-hot-toast";
import Hero from "./Hero";

export interface DashboardCardValue {
  value: number;
  difference: number;
}

interface DashboardData {
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  pendingTramites: DashboardCardValue;
  comisionesPendientes: number;
}

const initialDashboardData: DashboardData = {
  clients: { value: 0, difference: 0 },
  activeTramites: { value: 0, difference: 0 },
  pendingTramites: { value: 0, difference: 0 },
  comisionesPendientes: 0,
};

export default function DashboardBentoGrid() {
  const { userData } = useUser();
  const [dashboardData, setDashboardData] =
    React.useState<DashboardData>(initialDashboardData);
  const [loading, setLoading] = React.useState(true);
  const isFirstRender = React.useRef(true);

  const isBackOffice = userData?.role === "1";
  const isComercial = userData?.role === "2";

  const fetchData = React.useCallback(async () => {
    if (!userData || loading) {
      return;
    }

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
            current_week: false,
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
      const [{ data: clients }, { data }, { data: totalComisiones }] =
        await Promise.all([
          clientsRes.json(),
          activePendingRes.json(),
          comisionesRes.json(),
        ]);

      setDashboardData({
        clients,
        activeTramites: data.active,
        pendingTramites: data.pending,
        comisionesPendientes: totalComisiones,
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
    }
  }, [loading, userData]);

  React.useEffect(() => {
    if (userData) {
      fetchData();
      const timer = setTimeout(() => setLoading(false), 300);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [fetchData, userData]);

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          label="Cargando..."
          color="primary"
          size="lg"
          className="text-xl"
        />
      </div>
    );
  }

  const commonProps = {
    userData,
    loading,
    clients: dashboardData.clients,
    activeTramites: dashboardData.activeTramites,
    pendingTramites: dashboardData.pendingTramites,
  };

  return (
    <section className="mx-4 md:mx-8 xl:mx-12 px-2 py-8">
      <Hero loading={loading} userData={userData} />
      {isComercial ? (
        <ComercialView
          {...commonProps}
          comisionesPendientes={dashboardData.comisionesPendientes}
        />
      ) : isBackOffice ? (
        <BackofficeView {...commonProps} />
      ) : (
        <DireccionView
          {...commonProps}
          comisionesPendientes={dashboardData.comisionesPendientes}
        />
      )}
    </section>
  );
}
