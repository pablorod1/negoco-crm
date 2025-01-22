import { CheckCircle, CoinsIcon, TriangleAlert, Users } from "lucide-react";
import DashboardCard from "./Card";
import { TramitesResumePieChart } from "./charts/TramitesResumePieChart";
import { ComisionesChart } from "./charts/ComisionesChart";
import { YearlyTramitesBarChart } from "./charts/YearlyTramitesBarChart";
import RenewableTramitesCalendar from "./RenewableTramitesCalendar";
import { MonthlyTramitesBarChart } from "./charts/MonthlyTramitesBarChart";
import { TeamTramitesBarChart } from "./charts/TeamTramitesBarChar";

export default function DashboardBentoGrid() {
  return (
    <div className="mx-12 p-4">
      <div className="grid grid-cols-4 gap-4 items-stretch w-full">
        <div className="col-span-1 row-span-2 z-50">
          <TramitesResumePieChart />
        </div>

        <DashboardCard
          title="Clientes"
          value="230"
          description="Has captado un 2% más que la semana pasada"
          icon={<Users stroke="var(--primary-color-600)" />}
          color="pending"
        />
        <DashboardCard
          title="Trámites Activos"
          value="180"
          description="Has vendido un 2% más que la semana pasada"
          icon={<CheckCircle stroke="var(--success-color)" />}
          color="success"
        />
        <DashboardCard
          title="Trámites Pendientes"
          value="60"
          icon={<TriangleAlert stroke="var(--warning-color)" />}
          description="Has captado un 2% más que la semana pasada"
          color="warning"
        />
        <DashboardCard
          title="Comisiones Pendientes"
          value="5"
          description="Has captado un 2% más que la semana pasada"
          icon={<CoinsIcon stroke="var(--primary-color-800)" />}
          color="primary"
        />

        <div className="col-span-2 row-span-1 z-50">
          <ComisionesChart />
        </div>

        <div className="col-span-2 row-span-2 z-50">
          <YearlyTramitesBarChart />
        </div>

        <div className="col-span-2 row-span-2">
          <RenewableTramitesCalendar />
        </div>

        <div className="col-span-4">
          <MonthlyTramitesBarChart />
        </div>

        <div className="col-span-4">
          <TeamTramitesBarChart />
        </div>
      </div>
    </div>
  );
}
