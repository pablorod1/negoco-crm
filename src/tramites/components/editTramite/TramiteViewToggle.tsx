"use client";

import React from "react";
import {
  BarChart3,
  User,
  FileText,
  MessageCircle,
  History,
} from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type TramiteView =
  | "main"
  | "cliente"
  | "documentos"
  | "tickets"
  | "historial";

interface TramiteViewToggleProps {
  currentView: TramiteView;
  onViewChange: (view: TramiteView) => void;
  className?: string;
}

export const TramiteViewToggle = ({
  currentView,
  onViewChange,
  className = "",
}: TramiteViewToggleProps) => {
  const options: ViewOption<TramiteView>[] = [
    { value: "main", label: "Principal", shortLabel: "Main", icon: BarChart3 },
    { value: "cliente", label: "Cliente", shortLabel: "Cliente", icon: User },
    {
      value: "documentos",
      label: "Documentos",
      shortLabel: "Docs",
      icon: FileText,
    },
    {
      value: "tickets",
      label: "Tickets/Notas",
      shortLabel: "Tickets",
      icon: MessageCircle,
    },
    {
      value: "historial",
      label: "Historial",
      shortLabel: "Historial",
      icon: History,
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

export default TramiteViewToggle;
