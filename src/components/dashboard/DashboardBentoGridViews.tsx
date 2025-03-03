import { User } from "@/lib/core/types";
import DashboardCard from "./Card";
import { TramitesResumePieChart } from "./charts/TramitesResumePieChart";
import { DashboardCardValue } from "./DashboardBentoGrid";
import { CheckCircle, CoinsIcon, TriangleAlert, Users } from "lucide-react";
import { ComisionesChart } from "./charts/ComisionesChart";
import { YearlyTramitesBarChart } from "./charts/YearlyTramitesBarChart";
import RenewableTramitesCalendar from "./RenewableTramitesCalendar";
import { PersonalTramitesChart } from "./charts/PersonalTramitesBarChart";
import { TeamTramitesBarChart } from "./charts/TeamTramitesBarChar";
import { checkIfComercialHasSubcomerciales } from "@/lib/libsql/data/tramites/getTramites";
import { useCallback, useEffect, useState } from "react";

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
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-stretch ">
      <div className="col-span-1 sm:row-span-2 animate-size">
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
      <div className="col-span-1 sm:col-span-2  row-span-1">
        <ComisionesChart userData={userData} loading={loading} />
      </div>

      <div className="col-span-1 sm:col-span-4 xl:col-span-2 row-span-2">
        <YearlyTramitesBarChart loading={loading} />
      </div>

      <div className="col-span-1 sm:col-span-4 xl:col-span-2 row-span-2">
        <RenewableTramitesCalendar loading={loading} />
      </div>
      {/* <div className="col-span-1 sm:col-span-2 2xl:col-span-2 row-span-2">
          <h2>Comparativas Resume</h2>
        </div> */}
      <div className="col-span-1 sm:col-span-4 2xl:col-span-2">
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>
      <div className="col-span-1 sm:col-span-4 2xl:col-span-2 ">
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
  const comercialHasSubComerciales = useCallback(async () => {
    const { success } = await checkIfComercialHasSubcomerciales(userData);
    if (success) {
      setComercialHasSubComerciales(true);
    } else {
      setComercialHasSubComerciales(false);
    }
  }, [userData]);

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
        <RenewableTramitesCalendar loading={loading} />
      </div>
      {hasSubComerciales ? (
        <div className="col-span-1 sm:col-span-2 row-span-2">
          <PersonalTramitesChart userData={userData} loading={loading} />
        </div>
      ) : (
        <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-2">
          <h2>Comparativas Resume</h2>
        </div>
      )}

      {hasSubComerciales ? (
        <>
          <div className={`col-span-1 sm:col-span-2  xl:col-span-3`}>
            <TeamTramitesBarChart loading={loading} userData={userData} />
          </div>
          <div className="col-span-1 sm:col-span-1">
            <h2>Comparativas Resume</h2>
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
        <h2>Comparativas Resume</h2>
      </div>

      <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-2">
        <RenewableTramitesCalendar loading={loading} />
      </div>

      <div className="col-span-1 sm:col-span-2 xl:col-span-4">
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>
    </div>
  );
};
