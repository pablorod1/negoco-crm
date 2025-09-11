import React from "react";
import { cn } from "@/core/utils/utils";
import { TicketStatus } from "@/tickets/types/ticket.types";

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
}) => {
  const getStatusConfig = (statusName: string) => {
    switch (statusName) {
      case "abierto":
        return {
          color: "bg-blue-50 text-blue-700 border-blue-100",
          icon: <div className="w-2 h-2 bg-blue-500 rounded-full" />,
          label: "Abierto",
        };
      case "en_proceso":
        return {
          color: "bg-amber-50 text-amber-700 border-amber-100",
          icon: <div className="w-2 h-2 bg-amber-500 rounded-full" />,
          label: "En proceso",
        };
      case "resuelto":
        return {
          color: "bg-emerald-50 text-emerald-700 border-emerald-100",
          icon: <div className="w-2 h-2 bg-emerald-500 rounded-full" />,
          label: "Resuelto",
        };
      case "cerrado":
        return {
          color: "bg-gray-50 text-gray-600 border-gray-100",
          icon: <div className="w-2 h-2 bg-gray-400 rounded-full" />,
          label: "Cerrado",
        };
      default:
        return {
          color: "bg-gray-50 text-gray-600 border-gray-100",
          icon: <div className="w-2 h-2 bg-gray-400 rounded-full" />,
          label: "Desconocido",
        };
    }
  };

  const config = getStatusConfig(status.name);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
        config.color,
        className
      )}
    >
      {config.icon}
      {config.label}
    </div>
  );
};
