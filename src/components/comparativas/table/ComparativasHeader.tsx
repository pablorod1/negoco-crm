"use client";

import { ColumnSelector } from "@/components/tramites/table/TableToolbar";
import { ComparativaStatus, User } from "@/lib/core/types";
import { Input } from "@heroui/input";
import { Table } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { Download, Filter, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import AddComparativaDialog from "../createComparativa/AddComparativaDialog";
import ExportTableModal from "@/components/core/ExportTableModal";
import { MultiSelect } from "@/components/ui/multi-select";
import { Label } from "@/components/ui/label";
import { COMPARATIVA_STATUS_TYPES } from "@/lib/core/const";
import { cn } from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@heroui/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { DateRange } from "react-day-picker";

interface Props<TData> {
  filterValue: string;
  statusFilter: string[];
  setFilterValue: (value: string) => void;
  setStatusFilter: (value: ComparativaStatus[]) => void;
  resetFilters: () => void;
  table: Table<TData>;
  totalComparativas: number;
  userData: User;
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
}

const ComparativasHeader = <TData,>({
  filterValue,
  statusFilter,
  setFilterValue,
  setStatusFilter,
  resetFilters,
  table,
  totalComparativas,
  userData,
  dateRange,
  setDateRange,
}: Props<TData>) => {
  const [scrolled, setScrolled] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const isComercial = userData?.role === "2";

  useEffect(() => {
    const filters = [];
    if (statusFilter.length > 0) filters.push("Estado");
    setActiveFilters(filters);
  }, [statusFilter]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
                "font-bold text-3xl bg-gradient-to-r from-blue-700 to-blue-500 text-transparent bg-clip-text",
                scrolled ? "text-2xl" : "text-3xl"
              )}
            >
              Comparativas
            </h1>

            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 px-2.5 py-0.5"
            >
              {totalComparativas} Total
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
                  <ExportTableModal table={table} name={"Comparativas"} />
                </PopoverContent>
              </Popover>
            )}

            <AddComparativaDialog />
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
                  options={COMPARATIVA_STATUS_TYPES}
                  onValueChange={(value) =>
                    setStatusFilter(value as ComparativaStatus[])
                  }
                  value={statusFilter}
                  placeholder="Seleccionar estado"
                  maxCount={2}
                  variant="primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Creación</Label>

                <DateRangePicker date={dateRange} setDateRange={setDateRange} />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default ComparativasHeader;
