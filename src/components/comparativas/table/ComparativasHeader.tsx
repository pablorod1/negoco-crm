"use client";

import {
  ColumnSelector,
  FilterButton,
  StatusDropdown,
} from "@/components/tramites/table/TableToolbar";
import { ComparativaStatus } from "@/lib/core/types";
import { Input } from "@heroui/input";
import { Table } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { useEffect, useState } from "react";

interface Props<TData> {
  filterValue: string;
  statusFilter: string[];
  setFilterValue: (value: string) => void;
  setStatusFilter: (value: ComparativaStatus[]) => void;
  resetFilters: () => void;
  table: Table<TData>;
}

const ComparativasHeader = <TData,>({
  filterValue,
  statusFilter,
  setFilterValue,
  setStatusFilter,
  resetFilters,
  table,
}: Props<TData>) => {
  const [scrolled, setScrolled] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(true);

  const checkFilters = () => {
    return statusFilter.length > 0;
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearchShow = () => {
    setSearchVisible(!searchVisible);
  };

  const handleClearFilter = () => {
    setFilterValue("");
  };

  const handleFiltersShow = () => {
    setFiltersVisible(!filtersVisible);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -40 }}
      animate={{ opacity: 1, y: 0 }}
      className="pt-6"
    >
      <div className="mx-12 relative">
        <div
          className={`
            flex flex-col gap-4
          bg-white backdrop-blur-lg rounded-md 
          transition-all duration-300 shadow-md border border-gray-100
          ${scrolled ? "py-3 px-6" : "py-6 px-8"}
        `}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative"
              >
                <h1
                  className={`
                  font-bold transition-all duration-300
                  ${scrolled ? "text-3xl" : "text-4xl"}
                  bg-gradient-to-r from-[var(--primary-color-800)] to-[var(--primary-color-500)]
                  text-transparent bg-clip-text
                `}
                >
                  Comparativas
                </h1>
                <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full opacity-20" />
              </motion.div>
            </div>

            <div className="flex justify-end items-center w-full gap-3">
              <div
                className={`flex items-center ${filtersVisible ? "gap-3" : ""}`}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-100 text-gray-600"
                  onClick={handleFiltersShow}
                >
                  {filtersVisible ? (
                    <ChevronRight size={14} />
                  ) : (
                    <ChevronLeft size={14} />
                  )}
                  <Filter size={20} />
                </motion.button>
                <div
                  className={`flex items-center gap-3 overflow-x-hidden animate-size
                  ${filtersVisible ? "w-auto" : "w-0"}
                  `}
                >
                  <StatusDropdown
                    selected={statusFilter}
                    onSelectionChange={(value) =>
                      setStatusFilter(value as ComparativaStatus[])
                    }
                  />
                </div>
              </div>

              <div className="relative flex items-center">
                <div
                  className={`flex items-center transition-all duration-500 overflow-hidden ease-in-out ${
                    searchVisible ? "w-96" : "w-8 cursor-pointer"
                  }`}
                >
                  <Input
                    radius="sm"
                    value={filterValue}
                    onValueChange={setFilterValue}
                    variant="bordered"
                    isClearable={true}
                    onClear={handleClearFilter}
                    placeholder={
                      searchVisible
                        ? "Busca por CUPS, cliente, compañía..."
                        : ""
                    }
                    className="ps-12"
                  />
                  <Search
                    width={20}
                    height={20}
                    className={`cursor-pointer absolute text-gray-500 transition-all duration-500 ${
                      searchVisible ? "left-4" : "left-1"
                    }`}
                    onClick={handleSearchShow}
                  />
                </div>
              </div>

              {/* Add Comparativa Dialog */}
            </div>
          </div>
          <div className="flex justify-between items-center gap-2  w-full">
            <ColumnSelector table={table} />
            <FilterButton disabled={!checkFilters()} onPress={resetFilters} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ComparativasHeader;
