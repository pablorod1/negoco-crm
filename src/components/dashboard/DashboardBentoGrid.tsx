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
import Image from "next/image";
import SpinnerComponent from "../core/SpinnerComponent";
import { User } from "@/lib/core/types";
import { showCustomToast } from "../core/CustomToast";
import { CheckCircle, CircleX } from "lucide-react";

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
  const { userData } = useUser();
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

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="min-h-screen flex flex-col gap-4 items-center justify-center">
          <Spinner
            variant="gradient"
            color="primary"
            size="lg"
            className="relative"
          >
            <Image
              src="/logo_sin_letras.webp"
              alt="Logo"
              width={48}
              height={48}
              className="absolute -top-2 left-0 right-0 bottom-0 m-auto"
            />
          </Spinner>
          <div className="flex flex-col items-center text-center">
            <span className="text-xl font-bold">Cargando...</span>
            <span className="mt-2 text-gray-600 text-sm">
              Espera mientras cargamos todos los datos
            </span>
          </div>
        </div>
      </div>
    );
  }

  const commonProps = {
    userData,
    loading,
    clients: dashboardData.clients,
    activeTramites: dashboardData.activeTramites,
    totalBalance: dashboardData.totalBalance,
    comparativas: dashboardData.comparativas,
    refreshData,
  };

  return (
    <>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <SpinnerComponent userData={userData as User} />
        </div>
      ) : (
        <section className="flex flex-col gap-4 mx-2 py-8">
          <Hero {...commonProps} />
          {isComercial ? (
            <ComercialView {...commonProps} />
          ) : isBackOffice ? (
            <BackofficeView {...commonProps} />
          ) : isDireccion ? (
            <DireccionView {...commonProps} />
          ) : null}
        </section>
      )}
    </>
  );
}
