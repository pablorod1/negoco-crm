"use client";

import { motion } from "framer-motion";
import React from "react";
import { cn } from "@/core/utils";

export type ViewOption<V extends string> = {
  value: V;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  hidden?: boolean;
  badge?: number;
  badgeClass?: string;
  extraClass?: string;
};

interface ViewToggleProps<V extends string> {
  options: ViewOption<V>[];
  currentValue: V;
  onChange: (v: V) => void;
  className?: string;
}

export function ViewToggle<V extends string>({
  options,
  currentValue,
  onChange,
  className = "",
}: ViewToggleProps<V>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex justify-start", className)}
    >
      <div className="relative flex items-center gap-2 p-2 rounded-full ">
        {options.map((option) => {
          if (option.hidden) return null;
          const Icon = option.icon;
          const isActive = currentValue === option.value;
          return (
            <motion.button
              key={option.value}
              onClick={() => onChange(option.value)}
              aria-label={option.label}
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative z-10 flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-600/20",
                isActive
                  ? "bg-primary-600 text-white font-medium shadow"
                  : "bg-gray-50 text-gray-700 font-normal hover:bg-gray-100 hover:text-gray-900 shadow-2xs",
                option.extraClass ?? ""
              )}
            >
              <motion.span
                initial={false}
                animate={{ scale: isActive ? 1.12 : 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-center"
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive ? "text-white" : "text-gray-500"
                  )}
                />
              </motion.span>
              <span className="hidden sm:inline">{option.label}</span>
              <span className="sm:hidden">
                {option.shortLabel ?? option.label}
              </span>
              {typeof option.badge === "number" && option.badge > 0 && (
                <span
                  className={cn(
                    "ml-2 px-2 py-0.5 text-xs rounded-full transition-colors duration-200",
                    isActive
                      ? "bg-white/30 text-white font-semibold"
                      : (option.badgeClass ??
                          "bg-gray-100 text-gray-700 font-medium")
                  )}
                >
                  {option.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

export default ViewToggle;
