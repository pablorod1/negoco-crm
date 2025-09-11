"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  User,
  FileText,
  MessageCircle,
  History,
} from "lucide-react";
import { cn } from "@/core/utils";

export type TramiteView =
  | "main"
  | "cliente"
  | "documentos"
  | "tickets"
  | "historial";

interface TramiteViewToggleProps {
  currentView: TramiteView;
  onViewChange: (view: TramiteView) => void;
  className?: string;
}

interface PillOption {
  value: TramiteView;
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
    value: "cliente",
    label: "Cliente",
    shortLabel: "Cliente",
    icon: User,
  },
  {
    value: "documentos",
    label: "Documentos",
    shortLabel: "Docs",
    icon: FileText,
  },
  {
    value: "tickets",
    label: "Tickets/Notas",
    shortLabel: "Tickets",
    icon: MessageCircle,
  },
  {
    value: "historial",
    label: "Historial",
    shortLabel: "Historial",
    icon: History,
  },
];

export const TramiteViewToggle = ({
  currentView,
  onViewChange,
  className = "",
}: TramiteViewToggleProps) => {
  return (
    <div className={`flex justify-start ${className}`}>
      <div className="relative flex items-center gap-4 p-1 bg-gray-50 rounded-full">
        {/* Pills */}
        {pillOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentView === option.value;

          return (
            <motion.button
              key={option.value}
              onClick={() => onViewChange(option.value)}
              className={cn(
                "relative z-10 flex items-center gap-2 px-8 py-2.5 text-sm font-medium transition-all duration-200 rounded-full min-w-0",
                isActive
                  ? "bg-primary-900 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:text-primary-900 hover:bg-primary-100"
              )}
              whileHover={{ scale: isActive ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                animate={{
                  scale: isActive ? 1 : 0.9,
                }}
                transition={{ duration: 0.2 }}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
              </motion.div>
              <span className="hidden sm:block whitespace-nowrap">
                {option.label}
              </span>
              <span className="sm:hidden whitespace-nowrap">
                {option.shortLabel}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
