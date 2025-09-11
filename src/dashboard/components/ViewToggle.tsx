"use client";

import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TriangleAlert } from "lucide-react";
import { cn } from "@/core/utils/utils";

export type DashboardView = "main" | "comparativas" | "incidencias";

interface ViewToggleProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  className?: string;
  getPlan?: () => string | null; // Optional prop to get the current plan
}

interface PillOption {
  value: DashboardView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const pillOptions: PillOption[] = [
  {
    value: "main",
    label: "Dashboard",
    shortLabel: "Main",
    icon: BarChart3,
  },
  {
    value: "comparativas",
    label: "Comparativas",
    shortLabel: "Comp",
    icon: TrendingUp,
  },
  {
    value: "incidencias",
    label: "Incidencias",
    shortLabel: "Inc",
    icon: TriangleAlert,
  },
];

export const ViewToggle = ({
  currentView,
  onViewChange,
  className = "",
  getPlan,
}: ViewToggleProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex justify-start ${className}`}
    >
      <div className="relative flex items-center gap-2 p-1 rounded-full">
        {/* Background pill that moves */}

        {/* Pills */}
        {pillOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentView === option.value;
          const isStarterPlan = getPlan ? getPlan() === "starter" : false;

          return (
            <button
              key={option.value}
              onClick={() => onViewChange(option.value)}
              className={cn(
                "cursor-pointer relative z-10 flex justify-between items-center gap-2 px-4 py-2 text-sm font-extralight transition-colors duration-200 rounded-full  w-full",
                isActive
                  ? "bg-primary-500 text-white shadow"
                  : "bg-muted text-muted-foreground hover:text-foreground",
                isStarterPlan && option.value === "comparativas" ? "hidden" : ""
              )}
            >
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                <Icon className="h-4 w-4" />
              </motion.div>
              <span className="hidden sm:inline">{option.label}</span>
              <span className="sm:hidden">{option.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};
