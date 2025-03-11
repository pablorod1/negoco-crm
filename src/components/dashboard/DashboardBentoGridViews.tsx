import { User } from "@/lib/core/types";
import DashboardCard from "./Card";
import { TramitesResumePieChart } from "./charts/TramitesResumePieChart";
import { DashboardCardValue } from "./DashboardBentoGrid";
import {
  CheckCircle,
  CoinsIcon,
  Construction,
  Pickaxe,
  TriangleAlert,
  Users,
} from "lucide-react";
import { ComisionesChart } from "./charts/ComisionesChart";
import { YearlyTramitesBarChart } from "./charts/YearlyTramitesBarChart";
import RenewableTramitesCalendar from "./RenewableTramitesCalendar";
import { PersonalTramitesChart } from "./charts/PersonalTramitesBarChart";
import { TeamTramitesBarChart } from "./charts/TeamTramitesBarChar";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { ComparativasResume } from "./ComparativasResume";

interface Props {
  userData: User;
  loading: boolean;
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  pendingTramites: DashboardCardValue;
  comisionesPendientes: number;
}

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

export const DireccionView = ({
  userData,
  loading,
  clients,
  activeTramites,
  pendingTramites,
  comisionesPendientes,
}: Props) => {
  return (
    <div className="grid grid-cols-4 grid-rows-9 2xl:grid-rows-7 gap-6 ">
      <DashboardCard
        title="Clientes"
        value={clients.value}
        description={clients && formatDifferenceText(clients.difference)}
        icon={<Users stroke="var(--primary-color-800)" />}
        loading={loading}
      />

      <DashboardCard
        title="Trámites Activos"
        value={activeTramites.value}
        description={
          activeTramites && formatDifferenceText(activeTramites.difference)
        }
        icon={<CheckCircle stroke="var(--primary-color-800)" />}
        loading={loading}
      />

      <DashboardCard
        title="Trámites Pendientes"
        value={pendingTramites.value}
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

      <div className="row-start-2 col-start-3">
        <Card className="h-full w-full">
          <CardHeader className="text-xl font-medium text-[var(--primary-color-800)]">
            Ratio Conversión
          </CardHeader>
          <CardContent>
            <div className="flex flex-col justify-center items-center w-full h-full gap-2">
              <Construction size={54} className="text-gray-500" />
              <p className="text-center text-gray-500 text-sm">
                Estamos trabajando en esta sección. Pronto podrás ver el ratio
                de conversión de tus comparativas aquí.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="row-start-2 col-start-4">
        <Card className="h-full w-full">
          <CardHeader className="text-xl font-medium text-[var(--primary-color-800)]">
            Objetivos
          </CardHeader>
          <CardContent>
            <div className="flex flex-col justify-center items-center w-full h-full gap-2">
              <Pickaxe size={54} className="text-gray-500" />
              <p className="text-center text-gray-500 text-sm">
                Estamos trabajando en esta sección. Pronto podrás ver tus
                objetivos y metas aquí.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="col-span-2 row-span-2 row-start-2">
        <ComparativasResume userData={userData} loading={loading} />
      </div>
      <div className="col-span-2 row-span-2 col-start-1 row-start-4">
        {/* <TramitesResumePieChart userData={userData} loading={loading} /> */}
        <RenewableTramitesCalendar userData={userData} loading={loading} />
      </div>

      <div className="col-span-2 col-start-3 row-start-3">
        <ComisionesChart userData={userData} loading={loading} />
      </div>
      <div className="col-span-2 row-span-2 col-start-3 row-start-4">
        <YearlyTramitesBarChart loading={loading} />
      </div>
      <div className="col-span-4 2xl:col-span-2 row-span-2 row-start-6 col-start-1">
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>
      <div className="col-span-4 2xl:col-span-2 row-span-2 col-start-1 2xl:col-start-3 row-start-8 2xl:row-start-6">
        <TeamTramitesBarChart loading={loading} userData={userData} />
      </div>
    </div>
  );
};

export const ComercialView = ({
  userData,
  loading,
  clients,
  activeTramites,
  pendingTramites,
  comisionesPendientes,
}: Props) => {
  const [hasSubComerciales, setComercialHasSubComerciales] = useState(false);
  const id = userData.id;
  const comercialHasSubComerciales = useCallback(async () => {
    const res = await fetch(`/api/users/get/subcomerciales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });
    const { success } = await res.json();
    if (success) {
      setComercialHasSubComerciales(true);
    } else {
      setComercialHasSubComerciales(false);
    }
  }, [id]);

  useEffect(() => {
    comercialHasSubComerciales();
  }, [comercialHasSubComerciales]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch ">
      <div className="col-span-1 sm:row-span-2 xl:row-span-2 animate-size">
        <TramitesResumePieChart userData={userData} loading={loading} />
      </div>

      <DashboardCard
        title="Clientes"
        value={clients?.value}
        description={clients && formatDifferenceText(clients.difference)}
        icon={<Users stroke="var(--primary-color-800)" />}
        loading={loading}
      />
      <DashboardCard
        title="Trámites Activos"
        value={activeTramites?.value}
        description={
          activeTramites && formatDifferenceText(activeTramites.difference)
        }
        icon={<CheckCircle stroke="var(--primary-color-800)" />}
        loading={loading}
      />
      <DashboardCard
        title="Trámites Pendientes"
        value={pendingTramites?.value}
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
      <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-1 ">
        <ComisionesChart userData={userData} loading={loading} />
      </div>

      <div className="col-span-1 sm:col-span-2 row-span-2">
        <RenewableTramitesCalendar
          loading={loading}
          userData={userData as User}
        />
      </div>
      {hasSubComerciales ? (
        <div className="col-span-1 sm:col-span-2 row-span-2">
          <PersonalTramitesChart userData={userData} loading={loading} />
        </div>
      ) : (
        <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-2">
          <ComparativasResume userData={userData} loading={loading} />
        </div>
      )}

      {hasSubComerciales ? (
        <>
          <div className={`col-span-1 sm:col-span-2  xl:col-span-3`}>
            <TeamTramitesBarChart loading={loading} userData={userData} />
          </div>
          <div className="col-span-1 sm:col-span-1">
            <ComparativasResume userData={userData} loading={loading} />
          </div>
        </>
      ) : (
        <div className="col-span-1 sm:col-span-2 xl:col-span-4">
          <PersonalTramitesChart userData={userData} loading={loading} />
        </div>
      )}
    </div>
  );
};

interface BackofficeProps {
  userData: User;
  loading: boolean;
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  pendingTramites: DashboardCardValue;
}

export const BackofficeView = ({
  userData,
  loading,
  clients,
  activeTramites,
  pendingTramites,
}: BackofficeProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch ">
      <div className="flex flex-col gap-4 col-span-1 sm:row-span-3  animate-size">
        <DashboardCard
          title="Clientes"
          value={clients?.value}
          description={clients && formatDifferenceText(clients.difference)}
          icon={<Users stroke="var(--primary-color-800)" />}
          loading={loading}
        />
        <TramitesResumePieChart userData={userData} loading={loading} />
      </div>

      <DashboardCard
        title="Trámites Activos"
        value={activeTramites?.value}
        description={
          activeTramites && formatDifferenceText(activeTramites.difference)
        }
        icon={<CheckCircle stroke="var(--primary-color-800)" />}
        loading={loading}
      />
      <DashboardCard
        title="Trámites Pendientes"
        value={pendingTramites?.value}
        icon={<TriangleAlert stroke="var(--primary-color-800)" />}
        description={
          pendingTramites && formatDifferenceText(pendingTramites.difference)
        }
        loading={loading}
      />
      <div className="col-span-1  row-span-3 border border-gray-700">
        <ComparativasResume userData={userData} loading={loading} />
      </div>

      <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-2">
        <RenewableTramitesCalendar
          loading={loading}
          userData={userData as User}
        />
      </div>

      <div className="col-span-1 sm:col-span-2 xl:col-span-4">
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>
    </div>
  );
};
