"use client";

import { motion } from "framer-motion";
import { User, FileText, Folder, MessageCircle } from "lucide-react";
import { cn } from "@/core/utils";

export type ClientView = "main" | "tramites" | "files" | "tickets";

interface ClientViewToggleProps {
  currentView: ClientView;
  onViewChange: (view: ClientView) => void;
  className?: string;
}

interface PillOption {
  value: ClientView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const pillOptions: PillOption[] = [
  {
    value: "main",
    label: "Principal",
    shortLabel: "Main",
    icon: User,
  },
  {
    value: "tramites",
    label: "Trámites",
    shortLabel: "Trámites",
    icon: FileText,
  },
  {
    value: "files",
    label: "Archivos",
    shortLabel: "Files",
    icon: Folder,
  },
  {
    value: "tickets",
    label: "Tickets",
    shortLabel: "Tickets",
    icon: MessageCircle,
  },
];

export const ClientViewToggle = ({
  currentView,
  onViewChange,
  className = "",
}: ClientViewToggleProps) => {
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
