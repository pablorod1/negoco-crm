import { useMemo } from "react";
import { User } from "@/core/types";
import {
  getRoleLayoutConfig,
  RoleLayoutConfig,
} from "@/dashboard/config/roleLayouts";

export const useRoleBasedLayout = (
  userData: User | null,
  hasSubComerciales: boolean = false
): RoleLayoutConfig | null => {
  return useMemo(() => {
    if (!userData) return null;

    return getRoleLayoutConfig(userData, hasSubComerciales);
  }, [userData, hasSubComerciales]);
};

export const useDashboardConfig = (userData: User | null) => {
  const isSubcomercial = userData?.role === "2" && userData?.super_id !== null;
  const isComercial = userData?.role === "2" && userData?.super_id === null;
  const isBackoffice = userData?.role === "1";
  const isAdmin = userData?.role === "admin";

  return {
    isSubcomercial,
    isComercial,
    isBackoffice,
    isAdmin,
    roleConfig: {
      canSeeTeamData: isAdmin || (isComercial && !isSubcomercial),
      canSeeGlobalMetrics: isAdmin,
      canManageObjectives: isComercial || isSubcomercial || isAdmin,
      canSeeComparativas: !isSubcomercial || isAdmin || isBackoffice,
      prioritizePersonalData: isComercial || isSubcomercial,
      prioritizeOperationalData: isBackoffice,
      prioritizeStrategicData: isAdmin,
    },
  };
};
