import { useCallback, useState } from "react";
import { User } from "@/core/types";

interface Ticket {
  id: string;
  status_id: number;
  priority: "low" | "medium" | "high" | "urgent";
  created_by: string;
  assigned_to?: string;
}

export interface TicketsStats {
  total: number;
  open: number;
  inProgress: number;
  urgent: number;
  resolved: number;
  closed: number;
}

export interface TicketsData {
  stats: TicketsStats;
  loading: boolean;
  error: string | null;
}

export const useTicketsData = (userData: User | null) => {
  const [ticketsData, setTicketsData] = useState<TicketsData>({
    stats: {
      total: 0,
      open: 0,
      inProgress: 0,
      urgent: 0,
      resolved: 0,
      closed: 0,
    },
    loading: true,
    error: null,
  });

  const canSeeAllTickets = userData?.role === "admin" || userData?.role === "1";
  const isComercial = userData?.role === "2";

  const fetchTicketsStats = useCallback(async () => {
    if (!userData) return;

    setTicketsData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams({
        include_internal: canSeeAllTickets.toString(),
        type_id: "2", // incidencia type_id
      });

      const response = await fetch(`/api/v2/tickets?${params}`);
      const result = await response.json();

      if (result.success) {
        const tickets = result.data?.tickets || [];

        // Filter for comercial users
        const filteredTickets = isComercial
          ? tickets.filter(
              (ticket: Ticket) =>
                ticket.created_by === userData.id ||
                ticket.assigned_to === userData.id
            )
          : tickets;

        // Calculate stats
        const stats: TicketsStats = {
          total: filteredTickets.length,
          open: filteredTickets.filter((t: Ticket) => t.status_id === 1).length,
          inProgress: filteredTickets.filter((t: Ticket) => t.status_id === 2)
            .length,
          urgent: filteredTickets.filter((t: Ticket) => t.priority === "urgent")
            .length,
          resolved: filteredTickets.filter((t: Ticket) => t.status_id === 3)
            .length,
          closed: filteredTickets.filter((t: Ticket) => t.status_id === 4)
            .length,
        };

        setTicketsData({
          stats,
          loading: false,
          error: null,
        });
      } else {
        setTicketsData((prev) => ({
          ...prev,
          loading: false,
          error: result.error || "Error al cargar estadísticas de tickets",
        }));
      }
    } catch (error) {
      console.error("Error fetching tickets stats:", error);
      setTicketsData((prev) => ({
        ...prev,
        loading: false,
        error: "Error de conexión al cargar tickets",
      }));
    }
  }, [userData, canSeeAllTickets, isComercial]);

  return {
    ticketsData,
    fetchTicketsStats,
    refreshTicketsData: fetchTicketsStats,
  };
};
