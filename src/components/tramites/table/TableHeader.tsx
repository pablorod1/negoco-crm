"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import AddTramiteDialog from "../AddTramiteDialog";
import { getTramitesCountByStatus } from "@/lib/libsql/data/tramites/getTramites";
import { Input, Tooltip } from "@heroui/react";
import { Status, User } from "@/lib/core/types";
import {
  ColumnSelector,
  CompanyDropdown,
  ContractTypeDropdown,
  FilterButton,
  LiquidezStatusDropdown,
  StatusDropdown,
} from "./TableToolbar";
import { redirect } from "next/navigation";
import { Table } from "@tanstack/react-table";

interface Tramite {
  status: string;
  total: number;
}

interface TableHeaderProps<TData> {
  filterValue: string;
  title: string;
  companyFilter: string[];
  statusFilter: string[];
  liquidezStatusFilter: string[];
  contractTypeFilter: string[];
  selectedColumns: string[];
  setFilterValue: (value: string) => void;
  setCompanyFilter: (value: string[]) => void;
  setStatusFilter: (value: Status[]) => void;
  setLiquidezStatusFilter: (value: string[]) => void;
  setContractTypeFilter: (value: string[]) => void;
  setSelectedColumns: (value: string[]) => void;
  resetFilters: () => void;
  userData: User;
  table: Table<TData>;
}

const TramitesHeader = <TData,>({
  filterValue,
  title,
  companyFilter,
  statusFilter,
  liquidezStatusFilter,
  contractTypeFilter,
  selectedColumns,
  setSelectedColumns,
  setFilterValue,
  setCompanyFilter,
  setStatusFilter,
  setContractTypeFilter,
  setLiquidezStatusFilter,
  resetFilters,
  userData,
  table,
}: TableHeaderProps<TData>) => {
  const [scrolled, setScrolled] = useState(false);
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [totalTramites, setTotalTramites] = useState(0);
  const [tramitesCountVisible, setTramitesCountVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(true);

  const checkFilters = () => {
    return (
      companyFilter.length > 0 &&
      statusFilter.length > 0 &&
      liquidezStatusFilter.length > 0 &&
      contractTypeFilter.length > 0
    );
  };

  const fetchTramites = useCallback(async () => {
    const tramites = await getTramitesCountByStatus(userData);
    if (tramites) {
      setTramites(tramites);
      setTotalTramites(
        tramites.reduce((acc, tramite) => acc + tramite.total, 0)
      );
    }
  }, [userData]);

  useEffect(() => {
    fetchTramites();
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchTramites, setFilterValue]);

  const getStatusText = (tramite: Tramite) => {
    const texts: Record<string, [string, string]> = {
      Tramitable: ["Tramitable", "Tramitables"],
      Verificado: ["Verificado", "Verificados"],
      "Pendiente de Firma": ["Pendiente", "Pendientes"],
      Procesando: ["Procesando", "Procesando"],
      Activo: ["Activo", "Activos"],
      Borrador: ["Borrador", "Borradores"],
      Baja: ["Baja", "Bajas"],
    };

    const [singular, plural] = texts[tramite.status] || ["", ""];
    return tramite.total === 1 ? singular : plural;
  };

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

  const handleClearFilter = () => {
    setFilterValue("");
    redirect("/tramites");
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
                  {title}
                </h1>
                <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full opacity-20" />
              </motion.div>

              {title === "Trámites" && (
                <>
                  {" "}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center gap-6 overflow-x-hidden animate-size
                ${tramitesCountVisible ? "w-auto" : "w-20"}
                `}
                  >
                    <div className="flex items-center gap-2 text-gray-500 w-auto">
                      <span className="text-xl font-semibold">
                        {totalTramites}
                      </span>
                      <span className="text-sm">Total</span>
                    </div>
                    {tramites &&
                      tramites.map((tramite, index) => (
                        <div
                          className="flex flex-nowrap items-center gap-6 w-full"
                          key={index}
                        >
                          <div className="h-8 w-px bg-gray-200 " />

                          <div
                            className={`flex justify-center flex-nowrap items-center gap-2 text-gray-500 w-auto ${
                              tramite.status === "Borrador" &&
                              tramite.total > 20
                                ? "text-red-500"
                                : ""
                            }`}
                          >
                            <span className="text-xl font-semibold">
                              {tramite.total}
                            </span>
                            <Tooltip
                              isDisabled={
                                tramite.status !== "Borrador" ||
                                tramite.total < 20
                              }
                              color="danger"
                              showArrow
                              content={
                                <div className="px-1 py-2">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle
                                      size={18}
                                      strokeWidth="3"
                                      color="white"
                                    />
                                    <span className="text-sm font-bold">
                                      Hay demasiados borradores
                                    </span>
                                  </div>
                                  <div className="text-xs text-white">
                                    Se recomienda eliminar los trámites
                                    innecesarios
                                  </div>
                                </div>
                              }
                            >
                              <span className="text-sm">
                                {getStatusText(tramite)}
                              </span>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                  </motion.div>
                  {tramites && (
                    <motion.button
                      onClick={handleTramitesCountShow}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-600"
                    >
                      {tramitesCountVisible ? (
                        <ChevronLeft size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </motion.button>
                  )}
                </>
              )}
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
                  <CompanyDropdown
                    selected={companyFilter}
                    onSelectionChange={setCompanyFilter}
                  />
                  {title === "Trámites" ? (
                    <StatusDropdown
                      selected={statusFilter}
                      onSelectionChange={setStatusFilter}
                    />
                  ) : (
                    <LiquidezStatusDropdown
                      selected={liquidezStatusFilter}
                      onSelectionChange={setLiquidezStatusFilter}
                    />
                  )}
                  {title === "Trámites" && (
                    <ContractTypeDropdown
                      selected={contractTypeFilter}
                      onSelectionChange={setContractTypeFilter}
                    />
                  )}
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

              {title === "Trámites" && <AddTramiteDialog />}
            </div>
          </div>
          <div className="flex justify-between items-center gap-2  w-full">
            <ColumnSelector
              selectedColumns={selectedColumns}
              setSelectedColumns={setSelectedColumns}
              table={table}
            />
            <FilterButton disabled={!checkFilters()} onPress={resetFilters} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TramitesHeader;
