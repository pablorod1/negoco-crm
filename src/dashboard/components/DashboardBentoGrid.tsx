"use client";

import { useEffect } from "react";
import { useUser } from "@/core/contexts/UserContext";
import { Skeleton } from "@/core/components/ui/skeleton";
import { useDashboardData } from "@/dashboard/hooks/useDashboardData";
import { getUserRolePermissions } from "@/core/utils/userRoles";
import { DashboardView } from "./DashboardView";
import Hero from "./Hero";

// Re-export types for backward compatibility
export type { DashboardCardValue } from "@/dashboard/hooks/useDashboardData";

export default function DashboardBentoGrid() {
  const { userData, getPlan } = useUser();
  const { dashboardData, loading, fetchData, refreshData } =
    useDashboardData(userData);
  const permissions = getUserRolePermissions(userData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const commonProps = {
    userData: userData!,
    loading,
    clients: dashboardData.clients,
    activeTramites: dashboardData.activeTramites,
    totalBalance: dashboardData.totalBalance,
    comparativas: dashboardData.comparativas,
    refreshData,
    getPlan,
  };

  if (!userData) {
    return (
      <section className="flex flex-col gap-4 px-8 py-8">
        <Skeleton className="w-full h-72 rounded-xl bg-primary-500" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 px-8 py-8">
      {loading ? (
        <Skeleton className="w-full h-72 rounded-xl bg-primary-500" />
      ) : (
        <Hero {...commonProps} />
      )}
      <DashboardView
        userData={userData}
        loading={loading}
        dashboardData={dashboardData}
        refreshData={refreshData}
        getPlan={getPlan}
        permissions={permissions}
      />
    </section>
  );
}
