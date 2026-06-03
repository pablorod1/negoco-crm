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
import { useActiveFilters } from "@/comparativas/hooks/useActiveFilters";

interface Props<TData> {
  filterValue: string;
  statusFilter: string[] | undefined;
  setFilterValue: (value: string) => void;
  setStatusFilter: (value: string[]) => void;
  resetFilters: () => void;
  saveFiltersToStorage: () => void;
  table: Table<TData>;
  totalComparativas: number;
  userData: User;
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
  userFilter: string[] | undefined;
  setUserFilter: (value: string[] | undefined) => void;
  companyFilter: string[] | undefined;
  setCompanyFilter: (value: string[] | undefined) => void;
  excludeCompany: boolean;
  setExcludeCompany: (value: boolean) => void;
  excludeUser: boolean;
  setExcludeUser: (value: boolean) => void;
}

const ComparativasHeader = <TData,>({
  filterValue,
  statusFilter,
  setFilterValue,
  setStatusFilter,
  resetFilters,
  saveFiltersToStorage,
  table,
  totalComparativas,
  userData,
  dateRange,
  setDateRange,
  userFilter,
  setUserFilter,
  companyFilter,
  setCompanyFilter,
  excludeCompany,
  setExcludeCompany,
  excludeUser,
  setExcludeUser,
}: Props<TData>) => {
  const isComercial = userData?.role === "2";

  const activeFilters = useActiveFilters({
    statusFilter,
    dateRange,
    userFilter,
    isComercial,
    companyFilter,
  });

  // Save filters to localStorage when they change
  useEffect(() => {
    if (activeFilters.length > 0) saveFiltersToStorage();
  }, [
    statusFilter,
    dateRange,
    userFilter,
    companyFilter,
    excludeCompany,
    excludeUser,
    saveFiltersToStorage,
    activeFilters.length,
  ]);

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
            <h1 className="font-bold text-2xl text-gray-900">Comparativas</h1>
            <Badge
              variant="outline"
              className="bg-gray-50 text-gray-700 border-gray-200 px-3 py-1.5 text-sm font-medium"
            >
              {totalComparativas} registros
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <SearchBox
              value={filterValue}
              onChange={setFilterValue}
              placeholder="Buscar por cliente, comercial..."
            />

            {/* Filter Sheet */}
            <FilterSheet
              activeFiltersCount={activeFilters.length}
              statusFilter={statusFilter}
              dateRange={dateRange}
              userFilter={userFilter}
              setStatusFilter={setStatusFilter}
              setDateRange={setDateRange}
              setUserFilter={setUserFilter}
              resetFilters={resetFilters}
              userData={userData}
              companyFilter={companyFilter}
              setCompanyFilter={setCompanyFilter}
              excludeCompany={excludeCompany}
              setExcludeCompany={setExcludeCompany}
              excludeUser={excludeUser}
              setExcludeUser={setExcludeUser}
            />

            {/* Action Buttons */}
            <ActionButtons table={table} userData={userData} />
          </div>
        </div>

        {/* Active Filters */}
        <ActiveFilters
          statusFilter={statusFilter}
          dateRange={dateRange}
          userFilter={userFilter}
          companyFilter={companyFilter}
          excludeCompany={excludeCompany}
          excludeUser={excludeUser}
          isComercial={isComercial}
          onResetFilters={resetFilters}
        />
      </motion.div>
    </div>
  );
};

export default ComparativasHeader;
