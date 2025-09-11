"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/core/components/ui/sheet";
import { Label } from "@/core/components/ui/label";
import { DateRangePicker } from "@/dashboard/components/DateRangePicker";
import UserFilter from "@/core/components/table/UserFilter";
import { COMPARATIVA_STATUS_TYPES } from "@/comparativas/constants";
import TooltipComponent from "@/core/components/TooltipComponent";
import { cn } from "@/core/utils";
import type { User } from "@/core/types";
import type { DateRange } from "react-day-picker";
import MultipleSelector from "@/core/components/ui/multiselect";
import { useMultipleSelector } from "@/core/hooks/use-multiple-selector";

interface FilterSheetProps {
  activeFiltersCount: number;
  statusFilter: string[] | undefined;
  dateRange: DateRange | undefined;
  userFilter: string[] | undefined;
  setStatusFilter: (value: string[]) => void;
  setDateRange: (value: DateRange | undefined) => void;
  setUserFilter: (value: string[] | undefined) => void;
  resetFilters: () => void;
  userData: User;
}

export function FilterSheet({
  activeFiltersCount,
  statusFilter,
  dateRange,
  userFilter,
  setStatusFilter,
  setDateRange,
  setUserFilter,
  resetFilters,
  userData,
}: FilterSheetProps) {
  const [open, setOpen] = useState(false);
  const isComercial = userData?.role === "2";

  const { convertToOptions, convertFromOptions, getSelectedOptions } =
    useMultipleSelector();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <TooltipComponent content="Filtros avanzados">
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "h-10 w-10 bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors",
              activeFiltersCount > 0 &&
                "bg-primary-50 border-primary-200 text-primary-700"
            )}
          >
            <div className="relative">
              <Filter className="h-4 w-4" />
              {activeFiltersCount > 0 && (
                <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary-600" />
              )}
            </div>
          </Button>
        </SheetTrigger>
      </TooltipComponent>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-xl font-semibold text-gray-900">
            Filtros Avanzados
          </SheetTitle>
          <SheetDescription className="text-gray-500">
            Aplica filtros para refinar los resultados de las comparativas
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Status Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">Estado</Label>

            <MultipleSelector
              value={getSelectedOptions(statusFilter, COMPARATIVA_STATUS_TYPES)}
              defaultOptions={convertToOptions(COMPARATIVA_STATUS_TYPES)}
              onChange={(options) =>
                setStatusFilter(convertFromOptions(options))
              }
              placeholder="Seleccionar estado"
              className="w-full"
              hidePlaceholderWhenSelected
              emptyIndicator={
                <p className="text-center text-sm text-gray-500">
                  No se encontraron resultados
                </p>
              }
            />
          </div>

          {/* Date Range Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">
              Fecha de Creación
            </Label>
            <DateRangePicker date={dateRange} setDateRange={setDateRange} />
          </div>

          {/* User Filter (only for non-comercial users) */}
          {!isComercial && (
            <UserFilter
              isComercial={isComercial}
              userData={userData}
              userFilter={userFilter}
              setUserFilter={setUserFilter}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-6 mt-6 border-t border-gray-100 flex justify-between">
          <Button
            variant="outline"
            onClick={resetFilters}
            className="w-full mr-3"
          >
            Limpiar Filtros
          </Button>
          <Button onClick={() => setOpen(false)} className="w-full">
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
