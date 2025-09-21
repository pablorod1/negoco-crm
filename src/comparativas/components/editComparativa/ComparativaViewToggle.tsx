"use client";

import React from "react";
import { BarChart3, MessageCircle, History } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type ComparativaView = "main" | "tickets" | "history";

interface ComparativaViewToggleProps {
  currentView: ComparativaView;
  onViewChange: (view: ComparativaView) => void;
  className?: string;
  isAdmin?: boolean;
}

export const ComparativaViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  isAdmin = true,
}: ComparativaViewToggleProps) => {
  const options: ViewOption<ComparativaView>[] = [
    { value: "main", label: "Principal", shortLabel: "Main", icon: BarChart3 },
    {
      value: "tickets",
      label: "Tickets/Notas",
      shortLabel: "Tickets",
      icon: MessageCircle,
    },
    {
      value: "history",
      label: "Historial",
      shortLabel: "History",
      icon: History,
      hidden: !isAdmin,
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

export default ComparativaViewToggle;
