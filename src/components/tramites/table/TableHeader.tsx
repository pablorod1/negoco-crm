"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Filter, Search, Download, X } from "lucide-react";
import { Input } from "@heroui/input";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@heroui/tooltip";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/core/utils";
import type { Table } from "@tanstack/react-table";
import type { Status, User } from "@/lib/core/types";
import { ColumnSelector } from "./TableToolbar";
import AddTramiteDialog from "../createTramite/AddTramiteDialog";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  COMPANIES,
  CONTRACT_TYPES,
  LIQUIDEZ_STATUS,
  STATUS_TYPES,
} from "@/lib/core/const";
import ExportTableModal from "@/components/core/ExportTableModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";

interface TableHeaderProps<TData> {
  filterValue: string;
  title: string;
  companyFilter: string[];
  statusFilter: string[];
  liquidezStatusFilter: string[];
  contractTypeFilter: string[];
  setFilterValue: (value: string) => void;
  setCompanyFilter: (value: string[]) => void;
  setStatusFilter: (value: Status[]) => void;
  setLiquidezStatusFilter: (value: string[]) => void;
  setContractTypeFilter: (value: string[]) => void;
  resetFilters: () => void;
  userData: User;
  table: Table<TData>;
  totalTramites: number;
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
}

export default function TramitesHeader<TData>({
  filterValue,
  title,
  companyFilter,
  statusFilter,
  liquidezStatusFilter,
  contractTypeFilter,
  setFilterValue,
  setCompanyFilter,
  setStatusFilter,
  setLiquidezStatusFilter,
  setContractTypeFilter,
  resetFilters,
  table,
  totalTramites,
  userData,
  dateRange,
  setDateRange,
}: TableHeaderProps<TData>) {
  const [scrolled, setScrolled] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const isComercial = userData?.role === "2";

  // Update active filters
  useEffect(() => {
    const filters = [];
    if (companyFilter.length > 0) filters.push("Compañía");
    if (statusFilter.length > 0) filters.push("Estado");
    if (liquidezStatusFilter.length > 0) filters.push("Liquidez");
    if (contractTypeFilter.length > 0) filters.push("Contrato");
    setActiveFilters(filters);
  }, [companyFilter, statusFilter, liquidezStatusFilter, contractTypeFilter]);

  // Handle scroll and fetch data
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Clear search filter
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
              {title}
            </h1>

            <Badge
              variant="outline"
              className="bg-primary-50 text-primary-700 border-primary-200 px-2.5 py-0.5"
            >
              {totalTramites} Total
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative w-80">
              <Input
                radius="sm"
                variant="bordered"
                value={filterValue}
                onValueChange={setFilterValue}
                placeholder="Buscar por CUPS, cliente, compañía..."
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
              />
            </div>

            {/* Filter Button */}

            <Tooltip content="Filtros avanzados">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "h-10 w-10 bg-gray-50 border-gray-200",
                  showFilters && "bg-blue-50 border-blue-200 text-blue-700"
                )}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </Tooltip>

            {/* Column Selector */}

            <ColumnSelector table={table} />

            {/* Export Button */}

            {!isComercial && (
              <Popover>
                <Tooltip content="Exportar datos">
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 bg-gray-50 border-gray-200"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </Tooltip>
                <PopoverContent className="p-0 w-fit">
                  <ExportTableModal table={table} name={title} />
                </PopoverContent>
              </Popover>
            )}

            {/* Create Button */}
            {title === "Trámites" && <AddTramiteDialog />}
          </div>
        </div>

        {/* Status Tabs */}
        {title === "Trámites" && (
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
        )}

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
                  options={STATUS_TYPES}
                  onValueChange={(value) => setStatusFilter(value as Status[])}
                  value={statusFilter}
                  placeholder="Seleccionar estado"
                  maxCount={2}
                  variant="primary"
                />
              </div>

              <div className="space-y-2">
                <Label>Estado de liquidez</Label>

                <MultiSelect
                  options={LIQUIDEZ_STATUS}
                  onValueChange={setLiquidezStatusFilter}
                  value={liquidezStatusFilter}
                  placeholder="Seleccionar estado de liquidez"
                  maxCount={1}
                  variant="primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Contrato</Label>
                <MultiSelect
                  options={CONTRACT_TYPES}
                  onValueChange={setContractTypeFilter}
                  value={contractTypeFilter}
                  placeholder="Seleccionar tipo de contrato"
                  maxCount={1}
                  variant="primary"
                />
              </div>

              <div className="space-y-2">
                <Label>Compañía</Label>
                <MultiSelect
                  options={COMPANIES}
                  onValueChange={setCompanyFilter}
                  value={companyFilter}
                  placeholder="Seleccionar tipo de contrato"
                  maxCount={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Creación</Label>

                <DateRangePicker date={dateRange} setDateRange={setDateRange} />
              </div>
            </div>

            {/* <div className="flex justify-end mt-4">
              <FilterButton
                onPress={resetFilters}
                disabled={activeFilters.length === 0}
              />
            </div> */}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
