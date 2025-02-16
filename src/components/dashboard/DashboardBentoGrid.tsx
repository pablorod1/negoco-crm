"use client";
import { CheckCircle, CoinsIcon, TriangleAlert, Users } from "lucide-react";
import DashboardCard from "./Card";
import { TramitesResumePieChart } from "./charts/TramitesResumePieChart";
import { ComisionesChart } from "./charts/ComisionesChart";
import { YearlyTramitesBarChart } from "./charts/YearlyTramitesBarChart";
import RenewableTramitesCalendar from "./RenewableTramitesCalendar";
import { TeamTramitesBarChart } from "./charts/TeamTramitesBarChar";
import React from "react";
import {
  getActivePendingTramites,
  getClientsCount,
  getComisionesPendientes,
} from "@/lib/libsql/data/tramites/getTramites";
import { PersonalTramitesChart } from "./charts/MonthlyTramitesBarChart";

interface DashboardCardValue {
  value: number;
  difference: number;
}

export default function DashboardBentoGrid() {
  const [clients, setClients] = React.useState<DashboardCardValue>();
  const [activeTramites, setActiveTramites] =
    React.useState<DashboardCardValue>();
  const [pendingTramites, setPendingTramites] =
    React.useState<DashboardCardValue>();
  const [comisionesPendientes, setComisionesPendientes] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const fetchTramites = React.useCallback(async () => {
    try {
      const { active, pending } = await getActivePendingTramites();
      setActiveTramites(active);
      setPendingTramites(pending);
    } catch (error) {
      console.error("Error al obtener trámites:", error);
    }
  }, []);

  const fetchClients = React.useCallback(async () => {
    try {
      const clients = await getClientsCount();
      setClients(clients);
    } catch (error) {
      console.error("Error al obtener el total de clientes:", error);
    }
  }, []);

  const fetchComisionesPendientes = React.useCallback(async () => {
    try {
      const totalComisiones = await getComisionesPendientes();
      setComisionesPendientes(totalComisiones);
    } catch (error) {
      console.error(
        "Error al obtener el total de comisiones pendientes:",
        error
      );
    }
  }, []);

  const formatDifferenceText = (difference: number) => {
    if (difference > 50) {
      return `¡Increíble! 🚀 Has aumentado en un ${difference}% respecto al mes pasado.`;
    } else if (difference > 0) {
      return `¡Buen trabajo! Has logrado un ${difference}% más que el mes pasado. 💪`;
    } else if (difference < -50) {
      return `📉 Cuidado, has bajado un ${Math.abs(
        difference
      )}% respecto al mes pasado.`;
    } else if (difference < 0) {
      return `Este mes tienes un ${Math.abs(
        difference
      )}% menos que el mes pasado.`;
    } else {
      return `Te has mantenido igual que el mes pasado. 🔄`;
    }
  };

  React.useEffect(() => {
    fetchClients();
    fetchTramites();
    fetchComisionesPendientes();
    setTimeout(() => setLoading(false), 300);
  }, [fetchClients, fetchTramites, fetchComisionesPendientes]);
  return (
    <div className="mx-4 md:mx-8 xl:mx-12 p-2 md:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch w-full">
        <div className="col-span-1 sm:row-span-2 xl:row-span-2 z-50 animate-size">
          <TramitesResumePieChart loading={loading} />
        </div>

        <DashboardCard
          title="Clientes"
          value={clients && clients.value}
          description={clients && formatDifferenceText(clients.difference)}
          icon={<Users stroke="var(--primary-color-800)" />}
          loading={loading}
        />
        <DashboardCard
          title="Trámites Activos"
          value={activeTramites && activeTramites.value}
          description={
            activeTramites && formatDifferenceText(activeTramites.difference)
          }
          icon={<CheckCircle stroke="var(--primary-color-800)" />}
          loading={loading}
        />
        <DashboardCard
          title="Trámites Pendientes"
          value={pendingTramites && pendingTramites.value}
          icon={<TriangleAlert stroke="var(--primary-color-800)" />}
          description={
            pendingTramites && formatDifferenceText(pendingTramites.difference)
          }
          loading={loading}
        />
        <DashboardCard
          title="Comisiones Pendientes"
          value={comisionesPendientes}
          description="Total de comisiones pendientes por cobrar."
          icon={<CoinsIcon stroke="var(--primary-color-800)" />}
          loading={loading}
        />

        <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-1 z-50">
          <ComisionesChart loading={loading} />
        </div>

        <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-2 z-50">
          <YearlyTramitesBarChart loading={loading} />
        </div>

        <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-2">
          <RenewableTramitesCalendar loading={loading} />
        </div>

        <div className="col-span-1 sm:col-span-2 xl:col-span-4">
          <PersonalTramitesChart loading={loading} />
        </div>

        <div className="col-span-1 sm:col-span-2 xl:col-span-4">
          <TeamTramitesBarChart />
        </div>
      </div>
    </div>
  );
}
