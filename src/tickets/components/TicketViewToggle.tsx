"use client";

import React from "react";
import { AlertTriangle, StickyNote } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type TicketView = "incidencias" | "notas";

interface TicketViewToggleProps {
  currentView: TicketView;
  onViewChange: (view: TicketView) => void;
  className?: string;
  incidenciasCount?: number;
  notasCount?: number;
}

export const TicketViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  incidenciasCount = 0,
  notasCount = 0,
}: TicketViewToggleProps) => {
  const options: ViewOption<TicketView>[] = [
    {
      value: "incidencias",
      label: "Incidencias",
      icon: AlertTriangle,
      badge: incidenciasCount,
      badgeClass: "bg-orange-100 text-orange-700",
    },
    {
      value: "notas",
      label: "Notas Rápidas",
      icon: StickyNote,
      badge: notasCount,
      badgeClass: "bg-blue-100 text-blue-700",
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

export default TicketViewToggle;
