"use client";

import React from "react";
import { Coins, FileText, Folder, Zap } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";
import type { ComercializadoraView } from "@/comercializadoras/hooks/useComercializadoraViewNavigation";

export type { ComercializadoraView };

interface ComercializadoraViewToggleProps {
  currentView: ComercializadoraView;
  onViewChange: (view: ComercializadoraView) => void;
  className?: string;
  numTramites?: number;
  numFiles?: number;
  /** Muestra las vistas «Tarifas» y «Comisiones» del comparador propio. */
  showRates?: boolean;
}

export const ComercializadoraViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  numTramites,
  numFiles,
  showRates = false,
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
    ...(showRates
      ? [
          { value: "tarifas" as const, label: "Tarifas", shortLabel: "Tarifas", icon: Zap },
          { value: "comisiones" as const, label: "Comisiones", shortLabel: "Comisiones", icon: Coins },
        ]
      : []),
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
