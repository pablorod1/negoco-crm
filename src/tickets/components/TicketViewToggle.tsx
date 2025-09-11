"use client";

import { motion } from "framer-motion";
import { AlertTriangle, StickyNote } from "lucide-react";
import { cn } from "@/core/utils";

export type TicketView = "incidencias" | "notas";

interface TicketViewToggleProps {
  currentView: TicketView;
  onViewChange: (view: TicketView) => void;
  className?: string;
  incidenciasCount?: number;
  notasCount?: number;
}

interface PillOption {
  value: TicketView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const pillOptions: PillOption[] = [
  {
    value: "incidencias",
    label: "Incidencias",
    icon: AlertTriangle,
  },
  {
    value: "notas",
    label: "Notas Rápidas",
    icon: StickyNote,
  },
];

export const TicketViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  incidenciasCount = 0,
  notasCount = 0,
}: TicketViewToggleProps) => {
  const getCount = (view: TicketView) => {
    switch (view) {
      case "incidencias":
        return incidenciasCount;
      case "notas":
        return notasCount;
      default:
        return 0;
    }
  };

  return (
    <div className={`flex justify-start ${className}`}>
      <div className="relative flex items-center gap-4 p-1 bg-gray-50 rounded-full">
        {/* Pills */}
        {pillOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentView === option.value;
          const count = getCount(option.value);

          return (
            <motion.button
              key={option.value}
              onClick={() => onViewChange(option.value)}
              className={cn(
                "relative z-10 flex items-center gap-2 px-6 py-2.5 text-sm font-medium transition-all duration-200 rounded-full min-w-0",
                isActive
                  ? "bg-primary-900 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:text-primary-900 hover:bg-gray-100 border border-gray-200"
              )}
              whileHover={{ scale: isActive ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                className="flex items-center gap-2"
                initial={false}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                transition={{ duration: 0.15 }}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors duration-200",
                    isActive ? "text-white" : "text-gray-500"
                  )}
                />
                <span className="font-medium">{option.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-full",
                      isActive
                        ? "bg-white/20 text-white"
                        : option.value === "incidencias"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-blue-100 text-blue-700"
                    )}
                  >
                    {count}
                  </span>
                )}
              </motion.div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
