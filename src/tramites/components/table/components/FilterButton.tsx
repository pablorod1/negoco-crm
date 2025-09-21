"use client";

import { Filter } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";

interface FilterButtonProps {
  activeFiltersCount: number;
  onClick?: () => void;
}

export function FilterButton({
  activeFiltersCount,
  onClick,
}: FilterButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className={cn(
        "h-10 w-10 border-gray-200 hover:bg-gray-50 transition-colors",
        activeFiltersCount > 0 && "bg-primary-50 border-primary-200"
      )}
    >
      <div className="relative">
        <Filter className="h-4 w-4" />
        {activeFiltersCount > 0 && (
          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary-500" />
        )}
      </div>
    </Button>
  );
}
