"use client";

import React from "react";
import { Building2, FileText, Folder } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type ComercializadoraView = "main" | "tramites" | "documentos";

interface ComercializadoraViewToggleProps {
  currentView: ComercializadoraView;
  onViewChange: (view: ComercializadoraView) => void;
  className?: string;
}

export const ComercializadoraViewToggle = ({
  currentView,
  onViewChange,
  className = "",
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
