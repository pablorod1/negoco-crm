"use client";

import React from "react";
import { useUser } from "@/contexts/UserContext";
import {
  BackofficeView,
  ComercialView,
  DireccionView,
} from "./DashboardBentoGridViews";
import { Button, Spinner } from "@heroui/react";
import toast from "react-hot-toast";
import AvatarComponent from "../core/AvatarComponent";
import { Bell, CheckCircle, Folder, User } from "lucide-react";

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
      <div
        className={`flex items-center justify-between mb-6 bg-gradient-to-br from-[var(--primary-color-600)] to-[var(--primary-color-400)] p-4 rounded-full shadow-md overflow-hidden flex-nowrap animate-size  ${
          loading ? "w-32 h-32" : "w-auto"
        }`}
      >
        <div className="flex items-center gap-4 flex-nowrap">
          <AvatarComponent
            className={`size-24 !rounded-full shadow-md transition-transform duration-300 ${
              loading ? "scale-80" : "scale-100"
            }`}
            userData={userData}
            textSize="text-2xl"
          />
          <div className="ml-4 flex flex-col flex-nowrap gap-2">
            <h1 className="text-3xl font-bold text-white text-nowrap">
              Bienvenido, {userData.name} 👋
            </h1>
            {userData.notifications ? (
              <p className="text-sm text-gray-50 flex items-center text-nowrap">
                <Bell className="w-5 h-5 mr-2" /> Tienes{" "}
                {userData.notifications} notificaciones pendientes
              </p>
            ) : (
              <p className="text-base text-gray-100 flex items-center text-nowrap">
                <CheckCircle className="w-5 h-5 mr-2" /> No tienes
                notificaciones pendientes
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-nowrap mr-24">
          <Button
            variant="solid"
            radius="sm"
            startContent={<Folder className="size-5" />}
          >
            Documentación
          </Button>
          <Button
            variant="solid"
            radius="sm"
            startContent={<User className="size-5" />}
          >
            Ver perfil
          </Button>
        </div>
      </div>

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
