"use client";

import { motion } from "framer-motion";
import { User, UserCheck } from "lucide-react";
import { cn } from "@/core/utils";

export type ClientView = "client" | "signer";

interface ClientViewToggleProps {
  currentView: ClientView;
  onViewChange: (view: ClientView) => void;
  showSigner: boolean;
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
    value: "client",
    label: "Cliente",
    shortLabel: "Cliente",
    icon: User,
  },
  {
    value: "signer",
    label: "Firmante",
    shortLabel: "Firmante",
    icon: UserCheck,
  },
];

export const ClientViewToggle = ({
  currentView,
  onViewChange,
  showSigner,
  className = "",
}: ClientViewToggleProps) => {
  const visibleOptions = showSigner
    ? pillOptions
    : pillOptions.filter((option) => option.value === "client");

  if (!showSigner) {
    return null;
  }

  return (
    <div className={`flex justify-start ${className}`}>
      <div className="relative flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
        {/* Pills */}
        {visibleOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentView === option.value;

          return (
            <motion.button
              key={option.value}
              onClick={() => onViewChange(option.value)}
              className={cn(
                "relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-md min-w-0",
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
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
              <span className="whitespace-nowrap">{option.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
