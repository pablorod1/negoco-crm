import { useState, useCallback, useEffect } from "react";
import { Ticket } from "@/tickets/types/ticket.types";
import { User as UserType } from "@/core/types";

interface UseTicketsOptions {
  userData: UserType;
  context?: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  refId?: string;
  typeId?: string;
  includeInternal?: boolean;
}

export const useTickets = ({
  userData,
  context,
  refId,
  typeId,
  includeInternal,
}: UseTicketsOptions) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Permission checks
  const canSeeAllTickets = userData.role === "admin" || userData.role === "1";
  const isComercial = userData.role === "2";

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();

      if (context) params.append("context", context);
      if (refId) params.append("ref_id", refId);
      if (typeId) params.append("type_id", typeId);

      // Set include_internal based on user role and override
      const shouldIncludeInternal =
        includeInternal !== undefined ? includeInternal : canSeeAllTickets;

      params.append("include_internal", shouldIncludeInternal.toString());

      const response = await fetch(`/api/v2/tickets?${params}`);
      const result = await response.json();

      if (result.success) {
        let ticketData = result.data?.tickets || [];

        // Additional client-side filtering for comercial users
        if (isComercial) {
          ticketData = ticketData.filter(
            (ticket: Ticket) =>
              !ticket.is_internal || ticket.created_by === userData.id
          );
        }

        // Sort tickets by priority and creation date
        ticketData.sort((a: Ticket, b: Ticket) =>
          a.priority === b.priority
            ? new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            : a.priority.localeCompare(b.priority)
        );

        setTickets(ticketData);
      } else {
        setError(result.error || "Error fetching tickets");
        setTickets([]);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error fetching tickets";
      setError(errorMessage);
      console.error("Error fetching tickets:", err);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    context,
    refId,
    typeId,
    includeInternal,
    canSeeAllTickets,
    isComercial,
    userData.id,
  ]);

  const refreshTickets = useCallback(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Separate tickets by type
  const incidencias = tickets.filter((ticket) => ticket.type_name !== "note");
  const notas = tickets.filter((ticket) => ticket.type_name === "note");

  return {
    // Data
    tickets,
    incidencias,
    notas,

    // State
    isLoading,
    error,

    // Actions
    refreshTickets,

    // Permissions
    canSeeAllTickets,
    isComercial,
  };
};
