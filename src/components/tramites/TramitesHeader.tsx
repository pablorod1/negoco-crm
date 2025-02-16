"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
import AddTramiteDialog from "./AddTramiteDialog";
import { getTramitesCountByStatus } from "@/lib/libsql/data/tramites/getTramites";
import { Input } from "@heroui/react";
import { Status } from "@/lib/types";
import {
  CompanyDropdown,
  ContractTypeDropdown,
  FilterButton,
  StatusDropdown,
} from "./table/TableToolbar";

interface Tramite {
  status: string;
  total: number;
}

interface TableHeaderProps {
  filterValue: string;
  companyFilter: string[];
  statusFilter: string[];
  contractTypeFilter: string[];
  setFilterValue: (value: string) => void;
  setCompanyFilter: (value: string[]) => void;
  setStatusFilter: (value: Status[]) => void;
  setContractTypeFilter: (value: string[]) => void;
  resetFilters: () => void;
}

const TramitesHeader = ({
  filterValue,
  companyFilter,
  statusFilter,
  contractTypeFilter,
  setFilterValue,
  setCompanyFilter,
  setStatusFilter,
  setContractTypeFilter,
  resetFilters,
}: TableHeaderProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [totalTramites, setTotalTramites] = useState(0);
  const [tramitesCountVisible, setTramitesCountVisible] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  const fetchTramites = useCallback(async () => {
    const tramites = await getTramitesCountByStatus();
    if (tramites) {
      setTramites(tramites);
      setTotalTramites(
        tramites.reduce((acc, tramite) => acc + tramite.total, 0)
      );
    }
  }, []);

  useEffect(() => {
    fetchTramites();
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchTramites]);

  const handleFiltersShow = () => {
    setFiltersVisible(!filtersVisible);
    setTramitesCountVisible(false);
  };

  const handleTramitesCountShow = () => {
    setTramitesCountVisible(!tramitesCountVisible);
    setFiltersVisible(false);
    setSearchVisible(false);
  };

  const handleSearchShow = () => {
    setSearchVisible(!searchVisible);
    setTramitesCountVisible(false);
  };

  return (
    <div
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "pt-2" : "pt-6"
      }`}
    >
      <div className="mx-12 relative">
        <div
          className={`
          bg-white/80 backdrop-blur-lg rounded-2xl 
          transition-all duration-300 shadow-lg
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
                  Trámites
                </h1>
                <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full opacity-20" />
              </motion.div>

              <div className="h-8 w-px bg-gray-200" />

              <div
                className={`flex items-center gap-6 overflow-x-hidden animate-size
                ${tramitesCountVisible ? "w-auto" : "w-20"}
                `}
              >
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="text-2xl font-semibold">
                    {totalTramites}
                  </span>
                  <span className="text-sm">Total</span>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                {tramites &&
                  tramites.map((tramite, index) => (
                    <div
                      className="flex flex-nowrap items-center gap-6"
                      key={index}
                    >
                      <div className="flex flex-nowrap items-center gap-2 text-gray-500">
                        <span className="text-2xl font-semibold">
                          {tramite.total}
                        </span>
                        <span className="text-sm">
                          {tramite.status === "Tramitable"
                            ? "Tramitables"
                            : tramite.status === "Verificado"
                            ? "Verificados"
                            : tramite.status === "Pendiente de Firma"
                            ? "Pendientes"
                            : tramite.status === "Procesando"
                            ? "Procesando"
                            : tramite.status === "Activo"
                            ? "Activos"
                            : ""}
                        </span>
                      </div>
                      <div className="h-8 w-px bg-gray-200 " />
                    </div>
                  ))}
              </div>
              {tramites && (
                <motion.button
                  onClick={handleTramitesCountShow}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-600"
                >
                  {tramitesCountVisible ? (
                    <ChevronLeft size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </motion.button>
              )}
            </div>

            <div className="flex justify-end items-center w-full gap-3">
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
                <FilterButton onPress={resetFilters} />
                <CompanyDropdown
                  selected={companyFilter}
                  onSelectionChange={setCompanyFilter}
                />
                <StatusDropdown
                  selected={statusFilter}
                  onSelectionChange={setStatusFilter}
                />
                <ContractTypeDropdown
                  selected={contractTypeFilter}
                  onSelectionChange={setContractTypeFilter}
                />
              </div>

              <div className="relative flex items-center">
                <div
                  className={`flex items-center transition-all duration-500 overflow-hidden ease-in-out ${
                    searchVisible ? "w-96" : "w-8 cursor-pointer"
                  }`}
                >
                  <Input
                    value={filterValue}
                    onValueChange={setFilterValue}
                    variant="bordered"
                    isClearable={searchVisible}
                    onClear={() => setFilterValue("")}
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

              <AddTramiteDialog />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TramitesHeader;
