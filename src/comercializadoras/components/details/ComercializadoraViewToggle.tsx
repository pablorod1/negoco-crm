"use client";

import { motion } from "framer-motion";
import { Building2, FileText, Folder } from "lucide-react";
import { cn } from "@/core/utils";

export type ComercializadoraView = "main" | "tramites" | "documentos";

interface ComercializadoraViewToggleProps {
  currentView: ComercializadoraView;
  onViewChange: (view: ComercializadoraView) => void;
  className?: string;
}

interface PillOption {
  value: ComercializadoraView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const pillOptions: PillOption[] = [
  {
    value: "main",
    label: "Principal",
    shortLabel: "Main",
    icon: Building2,
  },
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

export const ComercializadoraViewToggle = ({
  currentView,
  onViewChange,
  className = "",
}: ComercializadoraViewToggleProps) => {
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
                "relative z-10 flex items-center gap-2 px-6 py-2.5 text-sm font-medium transition-all duration-200 rounded-full min-w-0",
                isActive
                  ? "bg-primary-900 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:text-primary-900 hover:bg-primary-100"
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
                }}
                transition={{ duration: 0.15 }}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{option.label}</span>
                <span className="sm:hidden">{option.shortLabel}</span>
              </motion.div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
