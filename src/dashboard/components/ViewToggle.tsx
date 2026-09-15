"use client";

import React from "react";
import { BarChart3, Search, TrendingUp, TriangleAlert } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type DashboardView = "main" | "metrics" | "incidencias" | "sips";

interface Props {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  className?: string;
  getPlan?: () => string | null;
  isDireccion?: boolean;
}

export const DashboardViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  getPlan,
  isDireccion,
}: Props) => {
  const isStarter = getPlan ? getPlan() === "starter" : false;

  const options: ViewOption<DashboardView>[] = [
    { value: "main", label: "Dashboard", shortLabel: "Main", icon: BarChart3 },
    {
      value: "metrics",
      label: "Métricas",
      shortLabel: "KPI",
      icon: TrendingUp,
      hidden: isStarter || !isDireccion,
    },
    {
      value: "incidencias",
      label: "Incidencias",
      shortLabel: "Inc",
      icon: TriangleAlert,
    },
    {
      value: "sips",
      label: "SIPS",
      shortLabel: "SIPS",
      icon: Search,
    },
  ];

  return (
    <GenericViewToggle
      options={options}
      currentValue={currentView}
      onChange={onViewChange}
      className={className}
    />
  );
};

export default DashboardViewToggle;
