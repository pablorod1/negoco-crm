"use client";

import React from "react";
import { FileText, Folder } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";
import type { ComercializadoraView } from "@/comercializadoras/hooks/useComercializadoraViewNavigation";

export type { ComercializadoraView };

interface ComercializadoraViewToggleProps {
  currentView: ComercializadoraView;
  onViewChange: (view: ComercializadoraView) => void;
  className?: string;
  numTramites?: number;
  numFiles?: number;
}

export const ComercializadoraViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  numTramites,
  numFiles,
}: ComercializadoraViewToggleProps) => {
  const options: ViewOption<ComercializadoraView>[] = [
    {
      value: "tramites",
      label: "Trámites",
      shortLabel: "Trámites",
      icon: FileText,
      badge: numTramites,
    },
    {
      value: "documentos",
      label: "Documentos",
      shortLabel: "Docs",
      icon: Folder,
      badge: numFiles,
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
