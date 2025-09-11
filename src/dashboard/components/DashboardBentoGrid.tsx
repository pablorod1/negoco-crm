"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/core/contexts/UserContext";
import { Skeleton } from "@/core/components/ui/skeleton";
import { useDashboardData } from "@/dashboard/hooks/useDashboardData";
import { useTicketsData } from "@/dashboard/hooks/useTicketsData";
import { getUserRolePermissions } from "@/core/utils/userRoles";
import { DashboardView } from "./DashboardView";
import { ViewToggle, DashboardView as ViewType } from "./ViewToggle";
import Hero from "./Hero";

// Re-export types for backward compatibility
export type { DashboardCardValue } from "@/dashboard/hooks/useDashboardData";

export default function DashboardBentoGrid() {
  const { userData, getPlan } = useUser();
  const { dashboardData, loading, fetchData, refreshData } =
    useDashboardData(userData);
  const { ticketsData, fetchTicketsStats, refreshTicketsData } =
    useTicketsData(userData);
  const permissions = getUserRolePermissions(userData);
  const [currentView, setCurrentView] = useState<ViewType>("main");

  useEffect(() => {
    fetchData();
    fetchTicketsStats();
  }, [fetchData, fetchTicketsStats]);

  const handleRefreshData = () => {
    refreshData();
    refreshTicketsData();
  };

  const commonProps = {
    userData: userData!,
    loading,
    clients: dashboardData.clients,
    activeTramites: dashboardData.activeTramites,
    totalBalance: dashboardData.totalBalance,
    comparativas: dashboardData.comparativas,
    totalConsumption: dashboardData.totalConsumption,
    refreshData: handleRefreshData,
    getPlan,
    currentView,
    ticketsData,
  };

  if (!userData) {
    return (
      <section className="flex flex-col gap-4 px-8 py-8">
        <Skeleton className="w-full h-72 rounded-xl  border border-gray-200" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 px-8 py-8">
      {loading ? (
        <Skeleton className="w-full h-72 rounded-3xl border border-gray-200" />
      ) : (
        <Hero {...commonProps} />
      )}

      {/* View Toggle */}
      <ViewToggle
        getPlan={getPlan}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* Dashboard View */}
      <DashboardView
        userData={userData}
        loading={loading}
        dashboardData={dashboardData}
        refreshData={refreshData}
        getPlan={getPlan}
        permissions={permissions}
        currentView={currentView}
      />
    </section>
  );
}
