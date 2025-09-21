import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/core/components/ui/sheet";
import { Button } from "@/core/components/ui/button";
import MultipleSelector, { Option } from "@/core/components/ui/multiselect";
import { X, Filter } from "lucide-react";

interface TicketFiltersSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  statusFilter: string[];
  priorityFilter: string[];
  contextFilter: string[];
  onStatusFilterChange: (values: string[]) => void;
  onPriorityFilterChange: (values: string[]) => void;
  onContextFilterChange: (values: string[]) => void;
  statusOptions: Option[];
  priorityOptions: Option[];
  contextOptions: Option[];
  onClearAllFilters: () => void;
}

export const TicketFiltersSheet: React.FC<TicketFiltersSheetProps> = ({
  isOpen,
  onOpenChange,
  statusFilter,
  priorityFilter,
  contextFilter,
  onStatusFilterChange,
  onPriorityFilterChange,
  onContextFilterChange,
  statusOptions,
  priorityOptions,
  contextOptions,
  onClearAllFilters,
}) => {
  const hasActiveFilters =
    statusFilter.length > 0 ||
    priorityFilter.length > 0 ||
    contextFilter.length > 0;

  const convertToOptions = (selectedOptions: Option[]): string[] => {
    return selectedOptions.map((option) => option.value);
  };

  const getSelectedStatusOptions = (selectedValues: string[]): Option[] => {
    return statusOptions.filter((option) =>
      selectedValues.includes(option.value)
    );
  };

  const getSelectedPriorityOptions = (selectedValues: string[]): Option[] => {
    return priorityOptions.filter((option) =>
      selectedValues.includes(option.value)
    );
  };

  const getSelectedContextOptions = (selectedValues: string[]): Option[] => {
    return contextOptions.filter((option) =>
      selectedValues.includes(option.value)
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600" />
              <SheetTitle>Filtros</SheetTitle>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAllFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar todo
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Status Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Estado
            </label>
            <MultipleSelector
              defaultOptions={statusOptions}
              value={getSelectedStatusOptions(statusFilter)}
              onChange={(selectedOptions: Option[]) =>
                onStatusFilterChange(convertToOptions(selectedOptions))
              }
              placeholder="Filtrar por estado..."
              className="w-full"
            />
          </div>

          {/* Priority Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Prioridad
            </label>
            <MultipleSelector
              defaultOptions={priorityOptions}
              value={getSelectedPriorityOptions(priorityFilter)}
              onChange={(selectedOptions: Option[]) =>
                onPriorityFilterChange(convertToOptions(selectedOptions))
              }
              placeholder="Filtrar por prioridad..."
              className="w-full"
            />
          </div>

          {/* Context Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Contexto
            </label>
            <MultipleSelector
              defaultOptions={contextOptions}
              value={getSelectedContextOptions(contextFilter)}
              onChange={(selectedOptions: Option[]) =>
                onContextFilterChange(convertToOptions(selectedOptions))
              }
              placeholder="Filtrar por contexto..."
              className="w-full"
            />
          </div>

          {/* Filter Summary */}
          {hasActiveFilters && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Filtros activos:
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                {statusFilter.length > 0 && (
                  <div>
                    <span className="font-medium">Estado:</span>{" "}
                    {statusFilter
                      .map(
                        (value) =>
                          statusOptions.find((opt) => opt.value === value)
                            ?.label
                      )
                      .join(", ")}
                  </div>
                )}
                {priorityFilter.length > 0 && (
                  <div>
                    <span className="font-medium">Prioridad:</span>{" "}
                    {priorityFilter
                      .map(
                        (value) =>
                          priorityOptions.find((opt) => opt.value === value)
                            ?.label
                      )
                      .join(", ")}
                  </div>
                )}
                {contextFilter.length > 0 && (
                  <div>
                    <span className="font-medium">Contexto:</span>{" "}
                    {contextFilter
                      .map(
                        (value) =>
                          contextOptions.find((opt) => opt.value === value)
                            ?.label
                      )
                      .join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
