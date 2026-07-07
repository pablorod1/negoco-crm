import { User } from "@/core/types";
import { DashboardData } from "../hooks/useDashboardData";
import { RolePermissions } from "@/core/utils/userRoles";
import { DashboardView as ViewType } from "./ViewToggle";
import {
  AdminLayout,
  BackofficeLayout,
  ComercialLayout,
  SubcomercialLayout,
} from "../layouts";
import { useCallback, useEffect, useState } from "react";
import { SipsConsultorView } from "./sips/SipsConsultorView";

interface DashboardViewProps {
  userData: User;
  loading: boolean;
  dashboardData: DashboardData;
  refreshData: () => void;
  getPlan: () => string | null;
  permissions: RolePermissions;
  currentView?: ViewType;
}

export const DashboardView = ({
  userData,
  loading,
  dashboardData,
  refreshData,
  getPlan,
  permissions,
  currentView = "main",
}: DashboardViewProps) => {
  const [hasSubComerciales, setComercialHasSubComerciales] = useState(false);
  const isSubcomercial = userData.role === "2" && userData.super_id !== null;

  const checkSubComerciales = useCallback(async () => {
    if (userData.role === "2" && !isSubcomercial) {
      try {
        const res = await fetch(`/api/v2/users/${userData.id}/team-members`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const { success } = await res.json();
        setComercialHasSubComerciales(success);
      } catch (error) {
        console.error("Error checking subcomerciales:", error);
        setComercialHasSubComerciales(false);
      }
    }
  }, [userData.id, userData.role, isSubcomercial]);

  useEffect(() => {
    checkSubComerciales();
  }, [checkSubComerciales]);

  if (currentView === "sips") {
    return <SipsConsultorView />;
  }

  const commonProps = {
    userData,
    loading,
    dashboardData,
    refreshData,
    getPlan,
    view: currentView,
  };

  // Subcomercial gets most restricted view
  if (isSubcomercial) {
    return <SubcomercialLayout {...commonProps} />;
  }

  // Regular comercial
  if (permissions.isComercial) {
    return (
      <ComercialLayout {...commonProps} hasSubComerciales={hasSubComerciales} />
    );
  }

  // Backoffice
  if (permissions.isBackOffice) {
    return <BackofficeLayout {...commonProps} />;
  }

  // Admin/Direccion
  if (permissions.isDireccion) {
    return <AdminLayout {...commonProps} />;
  }

  // Fallback
  return <div>No tienes permisos para ver este contenido.</div>;
};
