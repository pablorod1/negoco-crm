"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/core/contexts/UserContext";
import { Skeleton } from "@/core/components/ui/skeleton";
import { useDashboardData } from "@/dashboard/hooks/useDashboardData";
import { useTicketsData } from "@/dashboard/hooks/useTicketsData";
import { getUserRolePermissions } from "@/core/utils/userRoles";
import { DashboardView } from "./DashboardView";
import { DashboardViewToggle, DashboardView as ViewType } from "./ViewToggle";
import Hero from "./Hero";
import DashboardAnnouncementFloating from "./DashboardAnnouncementFloating";

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
  const canAccessMetrics = permissions.isDireccion;
  const visibleCurrentView: ViewType =
    canAccessMetrics || currentView !== "metrics" ? currentView : "main";

  useEffect(() => {
    fetchData();
    fetchTicketsStats();
  }, [fetchData, fetchTicketsStats]);

  useEffect(() => {
    if (!canAccessMetrics && currentView === "metrics") {
      setCurrentView("main");
    }
  }, [canAccessMetrics, currentView]);

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
    currentView: visibleCurrentView,
    ticketsData,
  };

  if (!userData) {
    return (
      <section className="flex flex-col gap-4 px-8 py-8">
        <>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="w-80 h-8 rounded-full border border-gray-200" />
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-8 rounded-full border border-gray-200" />
              <Skeleton className="w-8 h-8 rounded-full border border-gray-200" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
          </div>
        </>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 px-8 py-8">
      <DashboardAnnouncementFloating />

      {loading ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="w-80 h-8 rounded-full border border-gray-200" />
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-8 rounded-full border border-gray-200" />
              <Skeleton className="w-8 h-8 rounded-full border border-gray-200" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
            <Skeleton className="w-full h-44 rounded-4xl border border-gray-200" />
          </div>
        </>
      ) : (
        <Hero {...commonProps} />
      )}

      {/* View Toggle */}
      <DashboardViewToggle
        getPlan={getPlan}
        currentView={visibleCurrentView}
        onViewChange={setCurrentView}
        isDireccion={canAccessMetrics}
      />

      {/* Dashboard View */}
      <DashboardView
        userData={userData}
        loading={loading}
        dashboardData={dashboardData}
        refreshData={refreshData}
        getPlan={getPlan}
        permissions={permissions}
        currentView={visibleCurrentView}
      />
    </section>
  );
}
