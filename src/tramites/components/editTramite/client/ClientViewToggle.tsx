"use client";

import React from "react";
import { User, UserCheck } from "lucide-react";
import GenericViewToggle, { ViewOption } from "@/core/components/ViewToggle";

export type ClientView = "client" | "signer";

interface ClientViewToggleProps {
  currentView: ClientView;
  onViewChange: (view: ClientView) => void;
  showSigner: boolean;
  className?: string;
}

export const ClientViewToggle = ({
  currentView,
  onViewChange,
  showSigner,
  className = "",
}: ClientViewToggleProps) => {
  if (!showSigner) return null;

  const options: ViewOption<ClientView>[] = [
    { value: "client", label: "Cliente", shortLabel: "Cliente", icon: User },
    {
      value: "signer",
      label: "Firmante",
      shortLabel: "Firmante",
      icon: UserCheck,
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
