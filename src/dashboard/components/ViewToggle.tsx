"use client";

import React from "react";
import { BarChart3, TrendingUp, TriangleAlert } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type DashboardView = "main" | "comparativas" | "incidencias";

interface Props {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  className?: string;
  getPlan?: () => string | null;
}

export const DashboardViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  getPlan,
}: Props) => {
  const isStarter = getPlan ? getPlan() === "starter" : false;

  const options: ViewOption<DashboardView>[] = [
    { value: "main", label: "Dashboard", shortLabel: "Main", icon: BarChart3 },
    {
      value: "comparativas",
      label: "Comparativas",
      shortLabel: "Comp",
      icon: TrendingUp,
      hidden: isStarter,
    },
    {
      value: "incidencias",
      label: "Incidencias",
      shortLabel: "Inc",
      icon: TriangleAlert,
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
