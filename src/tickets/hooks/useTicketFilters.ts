import { useState, useMemo } from "react";
import { Ticket } from "@/tickets/types/ticket.types";

export const useTicketFilters = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(["1", "2"]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [contextFilter, setContextFilter] = useState<string[]>([]);

  const filterTickets = useMemo(() => {
    return (tickets: Ticket[]) => {
      return tickets.filter((ticket) => {
        // Search filter
        const matchesSearch =
          searchTerm === "" ||
          ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ticket.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (ticket.created_by_name &&
            ticket.created_by_name
              .toLowerCase()
              .includes(searchTerm.toLowerCase()));

        // Status filter
        const matchesStatus =
          statusFilter.length === 0 ||
          statusFilter.includes(ticket.status_id.toString());

        // Priority filter
        const matchesPriority =
          priorityFilter.length === 0 ||
          priorityFilter.includes(ticket.priority);

        // Context filter
        const matchesContext =
          contextFilter.length === 0 || contextFilter.includes(ticket.context);

        return (
          matchesSearch && matchesStatus && matchesPriority && matchesContext
        );
      });
    };
  }, [searchTerm, statusFilter, priorityFilter, contextFilter]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter([]);
    setPriorityFilter([]);
    setContextFilter([]);
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    statusFilter.length > 0 ||
    priorityFilter.length > 0 ||
    contextFilter.length > 0;

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchTerm !== "") count++;
    if (statusFilter.length > 0) count++;
    if (priorityFilter.length > 0) count++;
    if (contextFilter.length > 0) count++;
    return count;
  };

  return {
    // State
    searchTerm,
    statusFilter,
    priorityFilter,
    contextFilter,

    // Setters
    setSearchTerm,
    setStatusFilter,
    setPriorityFilter,
    setContextFilter,

    // Computed
    filterTickets,
    hasActiveFilters,
    getActiveFiltersCount,

    // Actions
    clearAllFilters,
  };
};
