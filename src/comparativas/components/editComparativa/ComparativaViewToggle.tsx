"use client";

import { motion } from "framer-motion";
import { BarChart3, MessageCircle, History } from "lucide-react";
import { cn } from "@/core/utils";

export type ComparativaView = "main" | "tickets" | "history";

interface ComparativaViewToggleProps {
  currentView: ComparativaView;
  onViewChange: (view: ComparativaView) => void;
  className?: string;
  isAdmin?: boolean;
}

interface PillOption {
  value: ComparativaView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  isAdminOnly?: boolean;
}

const pillOptions: PillOption[] = [
  {
    value: "main",
    label: "Principal",
    shortLabel: "Main",
    icon: BarChart3,
  },
  {
    value: "tickets",
    label: "Tickets/Notas",
    shortLabel: "Tickets",
    icon: MessageCircle,
  },
  {
    value: "history",
    label: "Historial",
    shortLabel: "History",
    icon: History,
    isAdminOnly: true,
  },
];

export const ComparativaViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  isAdmin = true,
}: ComparativaViewToggleProps) => {
  return (
    <div className={`flex justify-start ${className}`}>
      <div className="relative flex items-center gap-4 p-1 bg-gray-50 rounded-full">
        {/* Pills */}
        {pillOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentView === option.value;
          const shouldHide = option.isAdminOnly && !isAdmin;

          if (shouldHide) return null;

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
                <span className="hidden sm:inline font-medium">
                  {option.label}
                </span>
                <span className="sm:hidden font-medium">
                  {option.shortLabel}
                </span>
              </motion.div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
