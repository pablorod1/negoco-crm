"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Filter, Search, Download, X, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/core/utils";
import type { Table } from "@tanstack/react-table";
import type { User } from "@/lib/core/types";
import { ColumnSelector } from "./ColumnSelector";
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
import CreateBajaModal from "../createBaja/CreateBajaModal";
import { UpdateMultipleTramitesModal } from "../liquidez/UpdateMultipleTramitesModal";
import UserFilter from "@/components/core/table/UserFilter";
import { format } from "date-fns";
import { InputComponent } from "../createTramite/InputComponent";
import TooltipComponent from "@/components/core/TooltipComponent";

interface TableHeaderProps<TData> {
  filterValue: string;
  title: string;
  companyFilter: string[] | undefined;
  statusFilter: string[] | undefined;
  liquidezStatusFilter: string[] | undefined;
  contractTypeFilter: string[] | undefined;
  setFilterValue: (value: string) => void;
  setCompanyFilter: (value: string[]) => void;
  setStatusFilter: (value: string[]) => void;
  setLiquidezStatusFilter: (value: string[]) => void;
  setContractTypeFilter: (value: string[]) => void;
  resetFilters: () => void;
  userData: User;
  table: Table<TData>;
  totalTramites: number;
  activationDateRange: DateRange | undefined;
  creationDateRange: DateRange | undefined;
  renovationDateRange: DateRange | undefined;
  setActivationDateRange: (value: DateRange | undefined) => void;
  setCreationDateRange: (value: DateRange | undefined) => void;
  setRenovationDateRange: (value: DateRange | undefined) => void;
  collectionDateRange: DateRange | undefined;
  paymentDateRange: DateRange | undefined;
  setCollectionDateRange: (value: DateRange | undefined) => void;
  setPaymentDateRange: (value: DateRange | undefined) => void;
  saveFiltersToStorage: () => void;
  userFilter: string[] | undefined;
  setUserFilter: (value: string[] | undefined) => void;
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
  activationDateRange,
  creationDateRange,
  renovationDateRange,
  setActivationDateRange,
  setCreationDateRange,
  setRenovationDateRange,
  collectionDateRange,
  paymentDateRange,
  setCollectionDateRange,
  setPaymentDateRange,
  saveFiltersToStorage,
  userFilter,
  setUserFilter,
}: TableHeaderProps<TData>) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const isComercial = userData?.role === "2";

  const isTramitesTable = title === "Trámites";
  const isLiquidezTable = title === "Liquidez";

  // Update active filters
  useEffect(() => {
    const filters = [];
    if (companyFilter && companyFilter.length > 0) filters.push("Compañía");
    if (statusFilter && statusFilter.length > 0) filters.push("Estado");
    if (liquidezStatusFilter && liquidezStatusFilter.length > 0)
      filters.push("Liquidez");
    if (contractTypeFilter && contractTypeFilter.length > 0)
      filters.push("Contrato");
    if (
      activationDateRange &&
      (activationDateRange.from || activationDateRange.to)
    )
      filters.push("Fecha de Activación");
    if (creationDateRange && (creationDateRange.from || creationDateRange.to))
      filters.push("Fecha de Creación");
    if (
      renovationDateRange &&
      (renovationDateRange.from || renovationDateRange.to)
    )
      filters.push("Fecha de Renovación");

    if (
      collectionDateRange &&
      (collectionDateRange.from || collectionDateRange.to)
    )
      filters.push("Fecha de Cobro");
    if (paymentDateRange && (paymentDateRange.from || paymentDateRange.to))
      filters.push("Fecha de Pago");

    if (userFilter && userFilter.length > 0 && !isComercial)
      filters.push("Comercial");

    setActiveFilters(filters);
  }, [
    companyFilter,
    statusFilter,
    liquidezStatusFilter,
    contractTypeFilter,
    activationDateRange,
    creationDateRange,
    renovationDateRange,
    collectionDateRange,
    paymentDateRange,
    userFilter,
    isComercial,
  ]);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (activeFilters.length > 0) saveFiltersToStorage();
  }, [
    statusFilter,
    liquidezStatusFilter,
    contractTypeFilter,
    activationDateRange,
    creationDateRange,
    renovationDateRange,
    collectionDateRange,
    paymentDateRange,
    companyFilter,
    saveFiltersToStorage,
    activeFilters.length,
    userFilter,
  ]);

  // Clear search filter
  const handleClearSearch = () => {
    setFilterValue("");
  };

  const getFilterLabel = (
    filterType: string,
    values: string[] | DateRange,
    options?: { label: string; value: string; icon?: string }[]
  ) => {
    if (!values) return null;

    switch (filterType) {
      case "date":
        const dateRange = values as DateRange;
        if (!dateRange.from && !dateRange.to) return null;
        return `${dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : ""} - ${dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : ""}`;

      case "select":
        if (!Array.isArray(values) || values.length === 0) return null;
        return options
          ?.filter((opt) => values.includes(opt.value))
          .map((opt) => opt.label)
          .join(", ");

      default:
        return null;
    }
  };

  return (
    <div className="w-full px-6 pt-6 pb-2">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "bg-white rounded-xl border border-gray-100 shadow-sm transition-all duration-300 py-5 px-6"
        )}
      >
        {/* Header Top Row */}
        <div className="flex items-center justify-between gap-4  ">
          <div className="flex items-center gap-3">
            <h1
              className={cn(
                "font-bold text-3xl bg-gradient-to-r from-primary-700 to-primary-500 text-transparent bg-clip-text"
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
              <InputComponent
                name="search"
                type="text"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder="Buscar por CUPS, cliente, compañía..."
                startContent={<Search size={16} />}
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

            <TooltipComponent content="Filtros avanzados">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "h-10 w-10 bg-gray-50 border-gray-200",
                  showFilters && "bg-blue-50 border-blue-200 text-blue-700",
                  activeFilters.length > 0 && "bg-blue-50 border-blue-200"
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

            <ColumnSelector
              table={table}
              tableId={
                isTramitesTable ? "tramites" : isLiquidezTable ? "liquidez" : ""
              }
            />

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
                  <ExportTableModal table={table} name={title} />
                </PopoverContent>
              </Popover>
            )}

            {isLiquidezTable && (
              <UpdateMultipleTramitesModal
                table={table}
                userData={userData as User}
              />
            )}

            {/* Create Button */}
            {isTramitesTable && (
              <Popover>
                <TooltipComponent content="Crear nuevo trámite">
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 bg-gray-50 border-gray-200"
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipComponent>
                <PopoverContent
                  align="end"
                  className="flex flex-col p-2 gap-2 w-full"
                >
                  <AddTramiteDialog />
                  {!isComercial && <CreateBajaModal />}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Status Tabs */}

        <div className="flex items-center justify-between">
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">Filtros activos:</span>
              <div className="flex gap-1.5 flex-wrap">
                {statusFilter && statusFilter.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                  >
                    Estado:{" "}
                    {getFilterLabel("select", statusFilter, STATUS_TYPES)}
                  </Badge>
                )}

                {liquidezStatusFilter && liquidezStatusFilter.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                  >
                    Liquidez:{" "}
                    {getFilterLabel(
                      "select",
                      liquidezStatusFilter,
                      LIQUIDEZ_STATUS
                    )}
                  </Badge>
                )}

                {contractTypeFilter && contractTypeFilter.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                  >
                    Contrato:{" "}
                    {getFilterLabel(
                      "select",
                      contractTypeFilter,
                      CONTRACT_TYPES
                    )}
                  </Badge>
                )}

                {companyFilter && companyFilter.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                  >
                    Compañía:{" "}
                    {getFilterLabel("select", companyFilter, COMPANIES)}
                  </Badge>
                )}

                {creationDateRange &&
                  (creationDateRange.from || creationDateRange.to) && (
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                    >
                      Creación: {getFilterLabel("date", creationDateRange)}
                    </Badge>
                  )}

                {activationDateRange &&
                  (activationDateRange.from || activationDateRange.to) && (
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                    >
                      Activación: {getFilterLabel("date", activationDateRange)}
                    </Badge>
                  )}

                {renovationDateRange &&
                  (renovationDateRange.from || renovationDateRange.to) && (
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                    >
                      Renovación: {getFilterLabel("date", renovationDateRange)}
                    </Badge>
                  )}

                {collectionDateRange &&
                  (collectionDateRange.from || collectionDateRange.to) && (
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                    >
                      Cobro: {getFilterLabel("date", collectionDateRange)}
                    </Badge>
                  )}

                {paymentDateRange &&
                  (paymentDateRange.from || paymentDateRange.to) && (
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                    >
                      Pago: {getFilterLabel("date", paymentDateRange)}
                    </Badge>
                  )}
                {userFilter && userFilter.length > 0 && !isComercial && (
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-700 gap-1.5 flex items-center"
                  >
                    Comerciales: {userFilter.length} seleccionado(s)
                  </Badge>
                )}
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
        {activeFilters && showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 pt-4 border-t border-gray-100"
          >
            <div
              className={`grid ${isTramitesTable ? "grid-cols-4" : isLiquidezTable ? "grid-cols-3" : ""} gap-4`}
            >
              <div className="space-y-2">
                <Label>Estado</Label>

                <MultiSelect
                  options={
                    isTramitesTable
                      ? STATUS_TYPES
                      : isLiquidezTable
                        ? [
                            { label: "Activo", value: "Activo" },
                            { label: "Baja", value: "Baja" },
                          ]
                        : []
                  }
                  onValueChange={setStatusFilter}
                  value={statusFilter || []}
                  defaultValue={statusFilter || []}
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
                  defaultValue={liquidezStatusFilter}
                  placeholder="Seleccionar estado de liquidez"
                  maxCount={1}
                  variant="primary"
                />
              </div>
              {isTramitesTable && (
                <div className="space-y-2">
                  <Label>Contrato</Label>
                  <MultiSelect
                    options={CONTRACT_TYPES}
                    onValueChange={setContractTypeFilter}
                    value={contractTypeFilter}
                    defaultValue={contractTypeFilter}
                    placeholder="Seleccionar tipo de contrato"
                    maxCount={1}
                    variant="primary"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Compañía</Label>
                <MultiSelect
                  options={COMPANIES}
                  onValueChange={setCompanyFilter}
                  value={companyFilter}
                  defaultValue={companyFilter}
                  placeholder="Seleccionar tipo de contrato"
                  maxCount={3}
                />
              </div>
              {isTramitesTable && (
                <div className="space-y-2">
                  <Label>Fecha de Creación</Label>

                  <DateRangePicker
                    date={creationDateRange}
                    setDateRange={setCreationDateRange}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Fecha de Activación</Label>

                <DateRangePicker
                  date={activationDateRange}
                  setDateRange={setActivationDateRange}
                />
              </div>
              {isLiquidezTable && !isComercial && (
                <>
                  <div className="space-y-2">
                    <Label>Fecha de Cobro</Label>

                    <DateRangePicker
                      date={collectionDateRange}
                      setDateRange={setCollectionDateRange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Pago</Label>

                    <DateRangePicker
                      date={paymentDateRange}
                      setDateRange={setPaymentDateRange}
                    />
                  </div>
                </>
              )}
              {isTramitesTable && !isComercial && (
                <>
                  <div className="space-y-2">
                    <Label>Fecha de Renovación</Label>

                    <DateRangePicker
                      date={renovationDateRange}
                      setDateRange={setRenovationDateRange}
                    />
                  </div>
                  <UserFilter
                    isComercial={isComercial}
                    userData={userData}
                    userFilter={userFilter}
                    setUserFilter={setUserFilter}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
