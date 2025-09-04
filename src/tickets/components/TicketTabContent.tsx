"use client";

import type React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { Button } from "@/core/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import {
  type Ticket,
  type TicketReply,
  type TicketStatus,
  TICKET_PRIORITIES,
  DEFAULT_TICKET_STATUSES,
} from "@/tickets/types/ticket.types";
import type { ClientDB } from "@/tramites/types";
import type { User } from "@/core/types";
import { cn } from "@/core/utils";
import {
  CircleCheck,
  CircleX,
  MessageSquare,
  Tag,
  Users,
  Calendar,
  Filter,
  MoreVertical,
  Trash2,
  Reply,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import CreateTicketDialog from "./CreateTicketDialog";
import { formatDateTime } from "@/core/utils/format";
import { formatTicketType } from "../utils/format";

interface TicketTabContentProps {
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  refId: string;
  assignedTo: string; // ID of the user to whom tickets are assigned
  userData: User;
  client?: ClientDB;
  onRefresh?: () => void;
}

const StatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
  const getStatusConfig = (statusName: string) => {
    switch (statusName) {
      case "abierto":
        return {
          color: "bg-blue-50 text-blue-700 border-blue-100",
          icon: <div className="w-2 h-2 bg-blue-500 rounded-full" />,
          label: "Abierto",
        };
      case "en_proceso":
        return {
          color: "bg-amber-50 text-amber-700 border-amber-100",
          icon: <div className="w-2 h-2 bg-amber-500 rounded-full" />,
          label: "En proceso",
        };
      case "resuelto":
        return {
          color: "bg-emerald-50 text-emerald-700 border-emerald-100",
          icon: <div className="w-2 h-2 bg-emerald-500 rounded-full" />,
          label: "Resuelto",
        };
      case "cerrado":
        return {
          color: "bg-gray-50 text-gray-600 border-gray-100",
          icon: <div className="w-2 h-2 bg-gray-400 rounded-full" />,
          label: "Cerrado",
        };
      default:
        return {
          color: "bg-gray-50 text-gray-600 border-gray-100",
          icon: <div className="w-2 h-2 bg-gray-400 rounded-full" />,
          label: "Desconocido",
        };
    }
  };

  const config = getStatusConfig(status.name);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
        config.color
      )}
    >
      {config.icon}
      {config.label}
    </div>
  );
};

const PriorityBadge: React.FC<{ priority: keyof typeof TICKET_PRIORITIES }> = ({
  priority,
}) => {
  const priorityConfig = TICKET_PRIORITIES[priority];
  const getPriorityConfig = (priority: keyof typeof TICKET_PRIORITIES) => {
    switch (priority) {
      case "urgent":
        return {
          color: "bg-red-50 text-red-700 border-red-100",
          dot: "bg-red-500",
        };
      case "high":
        return {
          color: "bg-orange-50 text-orange-700 border-orange-100",
          dot: "bg-orange-500",
        };
      case "medium":
        return {
          color: "bg-blue-50 text-blue-700 border-blue-100",
          dot: "bg-blue-500",
        };
      case "low":
        return {
          color: "bg-gray-50 text-gray-600 border-gray-100",
          dot: "bg-gray-400",
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
  onTicketUpdated: () => void;
  onTicketDeleted: () => void;
}> = ({ ticket, userData, onTicketUpdated, onTicketDeleted }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  const canEdit =
    userData.role === "admin" ||
    userData.role === "1" ||
    ticket.created_by === userData.id;
  const canDelete =
    userData.role === "admin" ||
    userData.role === "1" ||
    ticket.created_by === userData.id;
  const canChangeStatus = userData.role === "admin" || userData.role === "1";
  const isComercial = userData.role === "2";

  // Hide internal tickets from comercial users
  if (isComercial && ticket.is_internal) {
    return null;
  }

  const handleStatusChange = async (newStatusId: number) => {
    if (!ticket?.id) {
      console.error("No ticket ID available for status change");
      return;
    }

    try {
      const response = await fetch(`/api/v2/tickets/${ticket.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status_id: newStatusId }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error updating status");
      }

      showCustomToast({
        title: "Estado actualizado",
        message: "El estado del ticket se ha actualizado correctamente",
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      onTicketUpdated();
    } catch (error) {
      console.error("Error updating ticket status:", error);
      showCustomToast({
        title: "Error",
        message:
          error instanceof Error
            ? error.message
            : "Error al actualizar el estado",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };

  const handleDelete = async () => {
    if (!ticket?.id) {
      console.error("No ticket ID available for deletion");
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
        icon: CircleCheck,
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
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };

  const loadReplies = async () => {
    if (replies.length > 0) return; // Already loaded
    if (!ticket?.id) {
      console.error("No ticket ID available for loading replies");
      return;
    }

    setIsLoadingReplies(true);
    try {
      const response = await fetch(`/api/v2/tickets/${ticket.id}/responses`);
      const result = await response.json();

      if (result.success) {
        setReplies(result.data || []);
      }
    } catch (error) {
      console.error("Error loading replies:", error);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const handleShowReplies = () => {
    setShowReplies(!showReplies);
    if (!showReplies) {
      loadReplies();
    }
  };

  const handleReplySubmit = async () => {
    if (!newReply.trim()) return;
    if (!ticket?.id) {
      console.error("No ticket ID available for reply");
      return;
    }

    try {
      const response = await fetch(`/api/v2/tickets/${ticket.id}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: newReply }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error adding reply");
      }

      showCustomToast({
        title: "Respuesta añadida",
        message: "La respuesta se ha añadido correctamente",
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      if (
        ticket.status_id === DEFAULT_TICKET_STATUSES.OPEN &&
        userData.role !== "2" // Comercial users cannot change status
      ) {
        handleStatusChange(DEFAULT_TICKET_STATUSES.IN_PROGRESS);
      }

      setNewReply("");
      // Reload replies
      setReplies([]);
      loadReplies();
    } catch (error) {
      console.error("Error adding reply:", error);
      showCustomToast({
        title: "Error",
        message:
          error instanceof Error
            ? error.message
            : "Error al añadir la respuesta",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {ticket.is_internal && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-100">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  Interno
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                {ticket.subject}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
                <Tag size={14} />
                {formatTicketType(ticket.type_name)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} />
                {ticket.created_by_name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} />
                {formatDateTime(ticket.created_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <StatusBadge
              status={{
                id: ticket.status_id,
                name: ticket.status_name || "",
                sort_order: 0,
              }}
            />
            <PriorityBadge priority={ticket.priority} />
            {(canEdit || canDelete) && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                  >
                    <MoreVertical size={16} className="text-gray-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                      Acciones del Ticket
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    {canChangeStatus && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Cambiar Estado
                        </label>
                        <Select
                          defaultValue={ticket.status_id.toString()}
                          onValueChange={(value) =>
                            handleStatusChange(Number.parseInt(value))
                          }
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value={DEFAULT_TICKET_STATUSES.OPEN.toString()}
                            >
                              Abierto
                            </SelectItem>
                            <SelectItem
                              value={DEFAULT_TICKET_STATUSES.IN_PROGRESS.toString()}
                            >
                              En Proceso
                            </SelectItem>
                            <SelectItem
                              value={DEFAULT_TICKET_STATUSES.RESOLVED.toString()}
                            >
                              Resuelto
                            </SelectItem>
                            <SelectItem
                              value={DEFAULT_TICKET_STATUSES.CLOSED.toString()}
                            >
                              Cerrado
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {canDelete && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        className="w-full justify-start h-10 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                      >
                        <Trash2 size={16} />
                        Eliminar Ticket
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div
          className={cn(
            "text-gray-700 leading-relaxed cursor-pointer transition-all duration-200",
            !isExpanded && "line-clamp-3"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {ticket.message}
        </div>

        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShowReplies}
            className="h-9 px-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
          >
            <MessageSquare size={16} />
            <span className="ml-2">Respuestas ({ticket.replies_count})</span>
            {showReplies ? (
              <ChevronDown size={14} className="ml-1" />
            ) : (
              <ChevronRight size={14} className="ml-1" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReplies(!showReplies)}
            className="h-9 px-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
          >
            <Reply size={16} />
            <span className="ml-2">Responder</span>
          </Button>
        </div>
      </div>

      {showReplies && (
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            {isLoadingReplies ? (
              <div className="text-center py-6">
                <div className="text-sm text-gray-500">
                  Cargando respuestas...
                </div>
              </div>
            ) : (
              <>
                {replies.length > 0 ? (
                  <ScrollArea className="max-h-60 w-full">
                    <div className="space-y-3 pr-3">
                      {replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="bg-white rounded-lg p-4 border border-gray-100"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-900 text-sm">
                              {reply.author_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(reply.created_at)}
                            </span>
                          </div>
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {reply.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-6">
                    <MessageSquare
                      size={24}
                      className="mx-auto text-gray-400 mb-2"
                    />
                    <p className="text-sm text-gray-500">
                      No hay respuestas aún
                    </p>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <textarea
                    rows={3}
                    placeholder="Escribe una respuesta..."
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleReplySubmit}
                    disabled={!newReply.trim()}
                    className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    Enviar Respuesta
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TicketTabContent: React.FC<TicketTabContentProps> = ({
  context,
  refId,
  assignedTo,
  userData,
  onRefresh,
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status_id?: number;
    include_internal: boolean;
  }>({
    include_internal: userData.role !== "2", // Comercial users don't see internal by default
  });

  const isComercial = userData.role === "2";

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        context,
        ref_id: refId.toString(),
        ...(filter.status_id && { status_id: filter.status_id.toString() }),
        include_internal: filter.include_internal.toString(),
      });

      const response = await fetch(`/api/v2/tickets?${params}`);
      const result = await response.json();

      if (result.success) {
        setTickets(result.data?.tickets || []);
      } else {
        console.error("Error fetching tickets:", result.error);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [context, refId, filter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleTicketCreated = () => {
    fetchTickets();
    onRefresh?.();
  };

  const handleTicketUpdated = () => {
    fetchTickets();
    onRefresh?.();
  };

  const handleTicketDeleted = () => {
    fetchTickets();
    onRefresh?.();
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Hide internal tickets from comercial users
      if (isComercial && ticket.is_internal) {
        return false;
      }
      return true;
    });
  }, [tickets, isComercial]);

  return (
    <div className="space-y-8 p-1">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Tickets
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Gestiona consultas, incidencias y solicitudes de manera eficiente
          </p>
        </div>
        <CreateTicketDialog
          context={context}
          refId={refId}
          userData={userData}
          assignedTo={assignedTo}
          onTicketCreated={handleTicketCreated}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              <Filter size={16} className="text-gray-600" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Filtros</span>
          </div>
          <Select
            value={filter.status_id?.toString() || "all"}
            onValueChange={(value) =>
              setFilter({
                ...filter,
                status_id: value === "all" ? undefined : Number.parseInt(value),
              })
            }
          >
            <SelectTrigger className="w-44 h-10 bg-gray-50 border-gray-200 rounded-lg">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value={DEFAULT_TICKET_STATUSES.OPEN.toString()}>
                Abiertos
              </SelectItem>
              <SelectItem
                value={DEFAULT_TICKET_STATUSES.IN_PROGRESS.toString()}
              >
                En Proceso
              </SelectItem>
              <SelectItem value={DEFAULT_TICKET_STATUSES.RESOLVED.toString()}>
                Resueltos
              </SelectItem>
              <SelectItem value={DEFAULT_TICKET_STATUSES.CLOSED.toString()}>
                Cerrados
              </SelectItem>
            </SelectContent>
          </Select>
          {!isComercial && (
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.include_internal}
                onChange={(e) =>
                  setFilter({ ...filter, include_internal: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 bg-gray-50 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              Incluir tickets internos
            </label>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3 text-gray-500">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Cargando tickets...</span>
            </div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Tag size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No hay tickets
            </h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto leading-relaxed">
              No se encontraron tickets para este {context}. Crea el primer
              ticket para comenzar.
            </p>
            <CreateTicketDialog
              context={context}
              refId={refId}
              userData={userData}
              assignedTo={assignedTo}
              onTicketCreated={handleTicketCreated}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map((ticket) => (
              <TicketItem
                key={ticket.id}
                ticket={ticket}
                userData={userData}
                onTicketUpdated={handleTicketUpdated}
                onTicketDeleted={handleTicketDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketTabContent;
