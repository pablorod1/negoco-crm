"use client";

import React from "react";
import { User, FileText, Folder, MessageCircle } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type ClientView = "main" | "tramites" | "files" | "tickets";

interface ClientViewToggleProps {
  currentView: ClientView;
  onViewChange: (view: ClientView) => void;
  className?: string;
}

export const ClientViewToggle = ({
  currentView,
  onViewChange,
  className = "",
}: ClientViewToggleProps) => {
  const options: ViewOption<ClientView>[] = [
    { value: "main", label: "Principal", shortLabel: "Main", icon: User },
    {
      value: "tramites",
      label: "Trámites",
      shortLabel: "Trámites",
      icon: FileText,
    },
    { value: "files", label: "Archivos", shortLabel: "Files", icon: Folder },
    {
      value: "tickets",
      label: "Tickets",
      shortLabel: "Tickets",
      icon: MessageCircle,
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

export default ClientViewToggle;
