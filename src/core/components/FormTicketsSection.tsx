"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/core/components/ui/button";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { showCustomToast } from "@/core/components/CustomToast";
import CreateTicketDialog from "@/tickets/components/CreateTicketDialog";
import { type Ticket, TICKET_PRIORITIES } from "@/tickets/types/ticket.types";
import type { User } from "@/core/types";
import { cn } from "@/core/utils";
import { StickyNote, AlertTriangle, Calendar, Trash2 } from "lucide-react";
import { formatDateTime } from "@/core/utils/format";
import { formatTicketType } from "@/tickets/utils/format";

interface FormTicketsSectionProps {
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  refId: string;
  assignedTo: string;
  userData: User;
  title?: string;
  subtitle?: string;
  onTicketUpdate?: () => void;
  isReadOnly?: boolean;
}

const PriorityBadge: React.FC<{ priority: keyof typeof TICKET_PRIORITIES }> = ({
  priority,
}) => {
  const priorityConfig = TICKET_PRIORITIES[priority];
  const getPriorityConfig = (priority: keyof typeof TICKET_PRIORITIES) => {
    switch (priority) {
      case "low":
        return {
          color: "bg-green-50 text-green-700 border-green-100",
          dot: "bg-green-500",
        };
      case "medium":
        return {
          color: "bg-blue-50 text-blue-700 border-blue-100",
          dot: "bg-blue-500",
        };
      case "high":
        return {
          color: "bg-amber-50 text-amber-700 border-amber-100",
          dot: "bg-amber-500",
        };
      case "urgent":
        return {
          color: "bg-red-50 text-red-700 border-red-100",
          dot: "bg-red-500",
        };
      default:
        return {
          color: "bg-gray-50 text-gray-600 border-gray-100",
          dot: "bg-gray-400",
        };
    }
  };

  const config = getPriorityConfig(priority);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
        config.color
      )}
    >
      <div className={cn("w-2 h-2 rounded-full", config.dot)} />
      {priorityConfig.label}
    </div>
  );
};

const TicketItem: React.FC<{
  ticket: Ticket;
  userData: User;
  compact?: boolean;
  onTicketDeleted: () => void;
}> = ({ ticket, userData, compact = false, onTicketDeleted }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const canDelete =
    userData.role === "admin" ||
    userData.role === "1" ||
    ticket.created_by === userData.id;
  const isComercial = userData.role === "2";
  const isNoteType = ticket.type_name === "note";

  // Hide internal tickets from comercial users
  if (isComercial && ticket.is_internal) {
    return null;
  }

  const handleDelete = async () => {
    if (!ticket?.id) {
      return;
    }

    if (!confirm("¿Estás seguro de que quieres eliminar este ticket?")) {
      return;
    }

    try {
      const response = await fetch(`/api/v2/tickets/${ticket.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error deleting ticket");
      }

      showCustomToast({
        title: "Ticket eliminado",
        message: "El ticket se ha eliminado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      onTicketDeleted();
    } catch (error) {
      console.error("Error deleting ticket:", error);
      showCustomToast({
        title: "Error",
        message:
          error instanceof Error
            ? error.message
            : "Error al eliminar el ticket",
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {isNoteType ? (
              <StickyNote className="w-4 h-4 text-yellow-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {formatTicketType(ticket.type_name)}
            </span>
          </div>

          {!isNoteType && ticket.subject && (
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              {ticket.subject}
            </h4>
          )}

          <div
            className={cn(
              "text-sm text-gray-600 mb-3",
              !isExpanded && "line-clamp-3"
            )}
          >
            {ticket.message}
          </div>

          {ticket.message.length > 150 && (
            <button type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {isExpanded ? "Ver menos" : "Ver más"}
            </button>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateTime(ticket.created_at)}
            </div>
            {ticket.created_by_name && (
              <div className="flex items-center gap-1">
                <span>Por: {ticket.created_by_name}</span>
              </div>
            )}
            {!isNoteType && ticket.priority && (
              <PriorityBadge priority={ticket.priority} />
            )}
          </div>
        </div>

        {canDelete && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const FormTicketsSection: React.FC<FormTicketsSectionProps> = ({
  context,
  refId,
  assignedTo,
  userData,
  onTicketUpdate,
  isReadOnly,
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch tickets from database using the refId
  const fetchTickets = useCallback(async () => {
    if (!refId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        context,
        ref_id: refId,
        include_internal: userData.role !== "2" ? "true" : "false",
      });

      const response = await fetch(`/api/v2/tickets?${params.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error fetching tickets");
      }
      setTickets(result.data.tickets || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      showCustomToast({
        title: "Error",
        message: "Error al cargar los tickets",
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setIsLoading(false);
    }
  }, [context, refId, userData.role]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleTicketCreated = () => {
    // Refresh tickets from database
    fetchTickets();
    onTicketUpdate?.();
  };

  const handleTicketDeleted = () => {
    // Refresh tickets from database
    fetchTickets();
    onTicketUpdate?.();
  };

  return (
    <div className="space-y-3">
      {/* Simplified Create Ticket Actions */}
      {!isReadOnly ? (
        <div className="flex gap-2">
          <CreateTicketDialog
            context={context}
            refId={refId}
            assignedTo={assignedTo}
            userData={userData}
            defaultType="note"
            onTicketCreated={handleTicketCreated}
          />
        </div>
      ) : null}

      {/* Simplified Tickets List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <ScrollArea className="w-full h-[280px]">
          <div className="space-y-2 p-4">
            {tickets.length > 0 ? (
              tickets.map((ticket) => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  userData={userData}
                  compact
                  onTicketDeleted={handleTicketDeleted}
                />
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No hay observaciones</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default FormTicketsSection;
