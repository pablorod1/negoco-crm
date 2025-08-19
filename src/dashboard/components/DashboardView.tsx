import { User } from "@/core/types";
import {
  BackofficeView,
  ComercialView,
  DireccionView,
} from "./DashboardBentoGridViews";
import { DashboardData } from "../hooks/useDashboardData";
import { RolePermissions } from "@/core/utils/userRoles";

interface DashboardViewProps {
  userData: User;
  loading: boolean;
  dashboardData: DashboardData;
  refreshData: () => void;
  getPlan: () => string | null;
  permissions: RolePermissions;
}

export const DashboardView = ({
  userData,
  loading,
  dashboardData,
  refreshData,
  getPlan,
  permissions,
}: DashboardViewProps) => {
  const commonProps = {
    userData,
    loading,
    clients: dashboardData.clients,
    activeTramites: dashboardData.activeTramites,
    totalBalance: dashboardData.totalBalance,
    comparativas: dashboardData.comparativas,
    totalConsumption: dashboardData.totalConsumption,
    refreshData,
    getPlan,
  };

  if (permissions.isComercial) {
    return <ComercialView {...commonProps} />;
  }

  if (permissions.isBackOffice) {
    return <BackofficeView {...commonProps} />;
  }

  if (permissions.isDireccion) {
    return <DireccionView {...commonProps} />;
  }

  return null;
};
