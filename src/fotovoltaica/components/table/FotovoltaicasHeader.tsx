"use client";

import { ColumnSelector } from "@/tramites/components/table/ColumnSelector";
import { User } from "@/core/types";
import { Table } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { Download, Filter, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ExportTableModal from "@/core/components/ExportTableModal";
import MultipleSelector from "@/core/components/ui/multiselect";
import { Label } from "@/core/components/ui/label";
import {
  FOTOVOLTAICA_STATUS_TYPES,
  FOTOVOLTAICA_TYPES,
} from "@/fotovoltaica/constants";
import { cn } from "@/core/utils";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { DateRangePicker } from "@/dashboard/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import UserFilter from "@/core/components/table/UserFilter";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import TooltipComponent from "@/core/components/TooltipComponent";
import AddFotovoltaicaDialog from "../createFotovoltaica/AddFotovoltaicaDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/core/components/ui/sheet";
import { useMultipleSelector } from "@/core/hooks/use-multiple-selector";

interface Props<TData> {
  filterValue: string;
  statusFilter: string[] | undefined;
  setFilterValue: (value: string) => void;
  setStatusFilter: (value: string[]) => void;
  resetFilters: () => void;
  saveFiltersToStorage: () => void; // Add this optional prop
  table: Table<TData>;
  totalFotovoltaicas: number;
  userData: User;
  creationDateRange: DateRange | undefined;
  setCreationDateRange: (dateRange: DateRange | undefined) => void;
  activationDateRange: DateRange | undefined;
  setActivationDateRange: (dateRange: DateRange | undefined) => void;
  typeFilter: string[] | undefined;
  setTypeFilter: (value: string[] | undefined) => void;
  userFilter: string[] | undefined;
  setUserFilter: (value: string[] | undefined) => void;
}

const FotovoltaicasHeader = <TData,>({
  filterValue,
  statusFilter,
  setFilterValue,
  setStatusFilter,
  resetFilters,
  saveFiltersToStorage,
  table,
  totalFotovoltaicas,
  userData,
  creationDateRange,
  setCreationDateRange,
  userFilter,
  setUserFilter,
  activationDateRange,
  setActivationDateRange,
  typeFilter,
  setTypeFilter,
}: Props<TData>) => {
  const [showFilters, setShowFilters] = useState(false);

  const isComercial = userData?.role === "2";

  const { convertToOptions, convertFromOptions, getSelectedOptions } =
    useMultipleSelector();

  const activeFilters = useMemo(() => {
    const filters: string[] = [];
    if (statusFilter && statusFilter.length > 0) filters.push("Estado");
    if (creationDateRange) filters.push("Fecha de Creación");
    if (activationDateRange) filters.push("Fecha de Activación");
    if (typeFilter && typeFilter.length > 0) filters.push("Tipo");
    if (userFilter && userFilter.length > 0 && !isComercial)
      filters.push("Comercial");
    return filters;
  }, [
    statusFilter,
    creationDateRange,
    activationDateRange,
    typeFilter,
    userFilter,
    isComercial,
  ]);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (activeFilters.length > 0) saveFiltersToStorage();
  }, [
    statusFilter,
    creationDateRange,
    activationDateRange,
    typeFilter,
    saveFiltersToStorage,
    activeFilters.length,
    userFilter,
  ]);

  const handleClearSearch = () => {
    setFilterValue("");
  };

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="py-6 pb-2 px-6"
      >
        {/* Header Top Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-2xl text-gray-900">Fotovoltáicas</h1>
            <Badge
              variant="outline"
              className="bg-gray-50 text-gray-700 border-gray-200 px-3 py-1.5 text-sm font-medium"
            >
              {totalFotovoltaicas} registros
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative w-80">
              <InputComponent
                type="text"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                startContent={<Search className="h-4 w-4" />}
                endContent={
                  filterValue && (
                    <button type="button"
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )
                }
                name="search"
                placeholder="Buscar por id, cliente..."
              />
            </div>

            {/* Filter Sheet */}
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-10 w-10 bg-gray-50 border-gray-200 hover:bg-gray-100",
                    activeFilters.length > 0 &&
                      "bg-primary-50 border-primary-200 text-primary-700"
                  )}
                >
                  <div className="relative">
                    <Filter className="h-4 w-4" />
                    {activeFilters.length > 0 && (
                      <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary-600" />
                    )}
                  </div>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full max-w-2xl">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>
                    Filtra los registros de fotovoltáicas según tus criterios.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <MultipleSelector
                        defaultOptions={convertToOptions(
                          FOTOVOLTAICA_STATUS_TYPES
                        )}
                        value={getSelectedOptions(
                          statusFilter,
                          FOTOVOLTAICA_STATUS_TYPES
                        )}
                        onChange={(selected) =>
                          setStatusFilter(convertFromOptions(selected))
                        }
                        placeholder="Seleccionar estado"
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <MultipleSelector
                        defaultOptions={convertToOptions(FOTOVOLTAICA_TYPES)}
                        value={getSelectedOptions(
                          typeFilter,
                          FOTOVOLTAICA_TYPES
                        )}
                        onChange={(selected) =>
                          setTypeFilter(convertFromOptions(selected))
                        }
                        placeholder="Seleccionar tipo"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Fecha de Creación</Label>
                      <DateRangePicker
                        date={creationDateRange}
                        setDateRange={setCreationDateRange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha de Activación</Label>
                      <DateRangePicker
                        date={activationDateRange}
                        setDateRange={setActivationDateRange}
                      />
                    </div>
                  </div>
                  {!isComercial && (
                    <UserFilter
                      isComercial={isComercial}
                      userData={userData}
                      userFilter={userFilter}
                      setUserFilter={setUserFilter}
                    />
                  )}
                  {activeFilters.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={resetFilters}
                      className="w-full"
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Column Selector */}
            <ColumnSelector table={table} tableId="fotovoltaicas" />

            {/* Export Button */}
            {!isComercial && (
              <Popover>
                <TooltipComponent content="Exportar datos">
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 bg-gray-50 border-gray-200 hover:bg-gray-100"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipComponent>
                <PopoverContent className="p-0 w-fit">
                  <ExportTableModal table={table} name={"Fotovoltaicas"} />
                </PopoverContent>
              </Popover>
            )}

            <AddFotovoltaicaDialog />
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-gray-500">Filtros activos:</span>
            <div className="flex gap-1.5">
              {activeFilters.map((filter, index) => (
                <Badge
                  key={filter}
                  variant="secondary"
                  className="bg-gray-100 text-gray-700 gap-1.5"
                >
                  {filter}
                </Badge>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 px-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Limpiar todo
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default FotovoltaicasHeader;
