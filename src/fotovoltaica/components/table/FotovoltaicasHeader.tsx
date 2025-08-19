"use client";

import { ColumnSelector } from "@/tramites/components/table/ColumnSelector";
import { User } from "@/core/types";
import { Table } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { Download, Filter, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import ExportTableModal from "@/core/components/ExportTableModal";
import { MultiSelect } from "@/core/components/ui/multi-select";
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
  saveFiltersToStorage, // Add this prop
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
  const [scrolled, setScrolled] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const isComercial = userData?.role === "2";

  useEffect(() => {
    const filters = [];
    if (statusFilter) filters.push("Estado");
    if (creationDateRange) filters.push("Fecha de Creación");
    if (activationDateRange) filters.push("Fecha de Activación");
    if (typeFilter && typeFilter.length > 0) filters.push("Tipo");
    if (userFilter && !isComercial) filters.push("Comercial");
    setActiveFilters(filters);
  }, [
    statusFilter,
    creationDateRange,
    activationDateRange,
    typeFilter,
    userFilter,
    isComercial,
  ]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (activeFilters.length > 0) saveFiltersToStorage();
  }, [
    statusFilter,
    creationDateRange,
    activationDateRange,
    typeFilter,
    saveFiltersToStorage,
    activeFilters,
    userFilter,
  ]);

  const handleClearSearch = () => {
    setFilterValue("");
  };

  return (
    <div className="w-full px-6 pt-6 pb-2">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "bg-white rounded-xl border border-gray-100 shadow-sm transition-all duration-300",
          scrolled ? "py-3 px-5" : "py-5 px-6"
        )}
      >
        {/* Header Top Row */}
        <div className="flex items-center justify-between gap-4  ">
          <div className="flex items-center gap-3">
            <h1
              className={cn(
                "font-bold text-3xl bg-gradient-to-r from-primary-700 to-primary-500 text-transparent bg-clip-text",
                scrolled ? "text-2xl" : "text-3xl"
              )}
            >
              Fotovoltáicas
            </h1>

            <Badge
              variant="outline"
              className="bg-primary-50 text-primary-700 border-primary-200 px-2.5 py-0.5"
            >
              {totalFotovoltaicas} Total
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
                    <button
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

            {/* Filter Button */}

            <TooltipComponent content="Filtros avanzados">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "h-10 w-10 bg-gray-50 border-gray-200",
                  showFilters &&
                    "bg-primary-50 border-primary-200 text-primary-700",
                  activeFilters.length > 0 && "bg-primary-50 border-primary-200"
                )}
              >
                <div className="relative">
                  <Filter className="h-4 w-4" />
                  {activeFilters.length > 0 && (
                    <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
              </Button>
            </TooltipComponent>

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
                      className="h-10 w-10 bg-gray-50 border-gray-200"
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

        {/* Status Tabs */}

        <div className="flex items-center justify-between">
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Filtros activos:</span>
              <div className="flex gap-1.5">
                {activeFilters.map((filter, index) => (
                  <Badge
                    key={index}
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
                Limpiar
              </Button>
            </div>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 pt-4 border-t border-gray-100"
          >
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>

                <MultiSelect
                  options={FOTOVOLTAICA_STATUS_TYPES}
                  onValueChange={setStatusFilter}
                  value={statusFilter}
                  defaultValue={statusFilter}
                  placeholder="Seleccionar estado"
                  maxCount={2}
                  variant="primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>

                <MultiSelect
                  options={FOTOVOLTAICA_TYPES}
                  onValueChange={setTypeFilter}
                  value={typeFilter}
                  defaultValue={typeFilter}
                  placeholder="Seleccionar tipo"
                  maxCount={2}
                  variant="primary"
                />
              </div>
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
              {!isComercial && (
                <UserFilter
                  isComercial={isComercial}
                  userData={userData}
                  userFilter={userFilter}
                  setUserFilter={setUserFilter}
                />
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default FotovoltaicasHeader;
