import React from "react";
import { cn } from "@/core/utils";
import { TICKET_PRIORITIES } from "@/tickets/types/ticket.types";

interface PriorityBadgeProps {
  priority: keyof typeof TICKET_PRIORITIES;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  className,
}) => {
  const priorityConfig = TICKET_PRIORITIES[priority];

  const getPriorityConfig = (priority: keyof typeof TICKET_PRIORITIES) => {
    switch (priority) {
      case "urgent":
        return {
          color: "bg-red-50 text-red-700 border-red-100",
          dot: "bg-red-500",
        };
      case "high":
        return {
          color: "bg-orange-50 text-orange-700 border-orange-100",
          dot: "bg-orange-500",
        };
      case "medium":
        return {
          color: "bg-blue-50 text-blue-700 border-blue-100",
          dot: "bg-blue-500",
        };
      case "low":
        return {
          color: "bg-gray-50 text-gray-600 border-gray-100",
          dot: "bg-gray-400",
        };
      default:
        return {
          color: "bg-gray-50 text-gray-600 border-gray-100",
          dot: "bg-gray-400",
        };
    }
  };

  const config = getPriorityConfig(priority);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
        config.color,
        className
      )}
    >
      <div className={cn("w-2 h-2 rounded-full", config.dot)} />
      {priorityConfig.label}
    </div>
  );
};
