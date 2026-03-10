"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/core/components/ui/badge";
import type { Table } from "@tanstack/react-table";
import type { User } from "@/core/types";
import { DateRange } from "react-day-picker";
import { SearchBox } from "./components/SearchBox";
import { FilterSheet } from "./components/FilterSheet";
import { ActionButtons } from "./components/ActionButtons";
import { ActiveFilters } from "./components/ActiveFilters";
import { useActiveFilters } from "@/tramites/hooks/useActiveFilters";
import { useProviderFilter } from "@/tramites/hooks/useProviderFilter";

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
  providerFilter: string[] | undefined;
  setProviderFilter: (value: string[] | undefined) => void;
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
  providerFilter,
  setProviderFilter,
}: TableHeaderProps<TData>) {
  const isComercial = userData?.role === "2";
  const isTramitesTable = title === "Trámites";
  const isLiquidezTable = title === "Liquidez";

  const activeFilters = useActiveFilters({
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
    providerFilter,
    isComercial,
  });

  const { removeProvider } = useProviderFilter({
    providerFilter,
    setProviderFilter,
  });

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
    providerFilter,
  ]);

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className=" py-6 pb-2"
      >
        {/* Header Top Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-2xl text-gray-900">{title}</h1>
            <Badge
              variant="outline"
              className="bg-gray-50 text-gray-700 border-gray-200 px-3 py-1.5 text-sm font-medium"
            >
              {totalTramites} registros
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <SearchBox
              value={filterValue}
              onChange={setFilterValue}
              placeholder="Buscar por CUPS, cliente, compañía..."
            />

            {/* Filter Sheet */}
            <FilterSheet
              activeFiltersCount={activeFilters.length}
              statusFilter={statusFilter}
              liquidezStatusFilter={liquidezStatusFilter}
              contractTypeFilter={contractTypeFilter}
              companyFilter={companyFilter}
              activationDateRange={activationDateRange}
              creationDateRange={creationDateRange}
              renovationDateRange={renovationDateRange}
              collectionDateRange={collectionDateRange}
              paymentDateRange={paymentDateRange}
              userFilter={userFilter}
              providerFilter={providerFilter}
              setStatusFilter={setStatusFilter}
              setLiquidezStatusFilter={setLiquidezStatusFilter}
              setContractTypeFilter={setContractTypeFilter}
              setCompanyFilter={setCompanyFilter}
              setActivationDateRange={setActivationDateRange}
              setCreationDateRange={setCreationDateRange}
              setRenovationDateRange={setRenovationDateRange}
              setCollectionDateRange={setCollectionDateRange}
              setPaymentDateRange={setPaymentDateRange}
              setUserFilter={setUserFilter}
              setProviderFilter={setProviderFilter}
              resetFilters={resetFilters}
              userData={userData}
              isTramitesTable={isTramitesTable}
              isLiquidezTable={isLiquidezTable}
            />

            {/* Action Buttons */}
            <ActionButtons
              table={table}
              userData={userData}
              isTramitesTable={isTramitesTable}
              isLiquidezTable={isLiquidezTable}
              title={title}
            />
          </div>
        </div>

        {/* Active Filters */}
        <ActiveFilters
          statusFilter={statusFilter}
          liquidezStatusFilter={liquidezStatusFilter}
          contractTypeFilter={contractTypeFilter}
          companyFilter={companyFilter}
          creationDateRange={creationDateRange}
          activationDateRange={activationDateRange}
          renovationDateRange={renovationDateRange}
          collectionDateRange={collectionDateRange}
          paymentDateRange={paymentDateRange}
          userFilter={userFilter}
          providerFilter={providerFilter}
          isComercial={isComercial}
          onResetFilters={resetFilters}
          onRemoveProvider={removeProvider}
        />
      </motion.div>
    </div>
  );
}
