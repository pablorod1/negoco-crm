"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import { Sheet, SheetTrigger } from "@/core/components/ui/sheet";
import { Skeleton } from "@/core/components/ui/skeleton";
import { Badge } from "@/core/components/ui/badge";
import {
  TicketItem,
  TicketFiltersSheet,
  useTickets,
  useTicketFilters,
  TICKET_STATUS_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_CONTEXT_OPTIONS,
} from "@/tickets";
import { User as UserType } from "@/core/types";
import { Filter, Search, X } from "lucide-react";

interface IncidenciasViewProps {
  userData: UserType;
  loading?: boolean;
}

export const IncidenciasView: React.FC<IncidenciasViewProps> = ({
  userData,
  loading = false,
}) => {
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Use custom hooks for tickets and filters
  const {
    tickets,
    isLoading: ticketsLoading,
    refreshTickets,
  } = useTickets({
    userData,
    typeId: "2", // Only incidencias
    includeInternal: userData.role !== "2", // Comercial users don't see internal by default
  });

  const {
    searchTerm,
    statusFilter,
    priorityFilter,
    contextFilter,
    setSearchTerm,
    setStatusFilter,
    setPriorityFilter,
    setContextFilter,
    filterTickets,
    hasActiveFilters,
    getActiveFiltersCount,
    clearAllFilters,
  } = useTicketFilters();

  // Apply filters to tickets
  const filteredTickets = filterTickets(tickets);

  const handleTicketUpdated = () => {
    refreshTickets();
  };

  const handleTicketDeleted = () => {
    refreshTickets();
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  if (loading || ticketsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Search & Filters - Compact Design */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="flex flex-col gap-3"
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar tickets por asunto, mensaje o autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 bg-white border-gray-200 focus:border-blue-400 focus:ring-blue-400"
            />
            {searchTerm && (
              <button type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters Sheet Trigger */}
          <Sheet open={showFiltersSheet} onOpenChange={setShowFiltersSheet}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="relative bg-white border-gray-200 hover:bg-gray-50"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {hasActiveFilters && (
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-blue-600 text-white text-xs"
                  >
                    {getActiveFiltersCount()}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>

            <TicketFiltersSheet
              isOpen={showFiltersSheet}
              onOpenChange={setShowFiltersSheet}
              statusFilter={statusFilter}
              priorityFilter={priorityFilter}
              contextFilter={contextFilter}
              onStatusFilterChange={setStatusFilter}
              onPriorityFilterChange={setPriorityFilter}
              onContextFilterChange={setContextFilter}
              statusOptions={TICKET_STATUS_OPTIONS}
              priorityOptions={TICKET_PRIORITY_OPTIONS}
              contextOptions={TICKET_CONTEXT_OPTIONS}
              onClearAllFilters={clearAllFilters}
            />
          </Sheet>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Filtros activos:</span>
            {statusFilter.length > 0 && (
              <Badge variant="outline" className="text-xs">
                Estado ({statusFilter.length})
              </Badge>
            )}
            {priorityFilter.length > 0 && (
              <Badge variant="outline" className="text-xs">
                Prioridad ({priorityFilter.length})
              </Badge>
            )}
            {contextFilter.length > 0 && (
              <Badge variant="outline" className="text-xs">
                Contexto ({contextFilter.length})
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar
            </Button>
          </div>
        )}
      </motion.div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {filteredTickets.length === tickets.length
            ? `${tickets.length} tickets en total`
            : `${filteredTickets.length} de ${tickets.length} tickets`}
        </span>
        {hasActiveFilters && (
          <span className="text-blue-600">Filtros aplicados</span>
        )}
      </div>

      {/* Tickets List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="space-y-4"
      >
        {filteredTickets.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {hasActiveFilters
                ? "No se encontraron tickets"
                : "No hay tickets"}
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {hasActiveFilters
                ? "Prueba a ajustar los filtros o realizar una búsqueda diferente."
                : "No se han creado tickets todavía."}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="mt-4"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <TicketItem
              key={ticket.id}
              ticket={ticket}
              userData={userData}
              onTicketUpdated={handleTicketUpdated}
              onTicketDeleted={handleTicketDeleted}
            />
          ))
        )}
      </motion.div>
    </motion.div>
  );
};
