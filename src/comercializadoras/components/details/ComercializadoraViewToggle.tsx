"use client";

import React from "react";
import { Building2, FileText, Folder, Tag } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type ComercializadoraView =
  | "main"
  | "tramites"
  | "documentos"
  | "tarifas";

interface ComercializadoraViewToggleProps {
  currentView: ComercializadoraView;
  onViewChange: (view: ComercializadoraView) => void;
  className?: string;
  showRates?: boolean;
}

export const ComercializadoraViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  showRates = false,
}: ComercializadoraViewToggleProps) => {
  const options: ViewOption<ComercializadoraView>[] = [
    { value: "main", label: "Principal", shortLabel: "Main", icon: Building2 },
    {
      value: "tramites",
      label: "Trámites",
      shortLabel: "Trámites",
      icon: FileText,
    },
    {
      value: "documentos",
      label: "Documentos",
      shortLabel: "Docs",
      icon: Folder,
    },
    {
      value: "tarifas",
      label: "Tarifas",
      shortLabel: "Tarifas",
      icon: Tag,
      hidden: !showRates,
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

export default ComercializadoraViewToggle;
