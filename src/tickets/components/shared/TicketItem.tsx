import React, { useState } from "react";
import { cn } from "@/core/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { TicketRepliesSheet } from "./TicketRepliesSheet";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  CircleCheck,
  CircleX,
  MoreVertical,
  MessageCircle,
  Settings,
  Trash2,
  User,
  Calendar,
  Tag,
  ExternalLink,
} from "lucide-react";
import { Ticket, TicketStatus } from "@/tickets/types/ticket.types";
import { User as UserType } from "@/core/types";
import { Badge } from "@/core/components/ui/badge";

interface TicketItemProps {
  ticket: Ticket;
  userData: UserType;
  onTicketUpdated: () => void;
  onTicketDeleted: () => void;
  className?: string;
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatContext = (context: string) => {
  switch (context) {
    case "tramite":
      return "Trámite";
    case "cliente":
      return "Cliente";
    case "comparativa":
      return "Comparativa";
    case "fotovoltaica":
      return "Fotovoltaica";
    default:
      return context;
  }
};

// Status options for dropdown
const STATUS_OPTIONS = [
  { label: "Abierto", value: "1" },
  { label: "En Proceso", value: "2" },
  { label: "Resuelto", value: "3" },
  { label: "Cerrado", value: "4" },
];

export const TicketItem: React.FC<TicketItemProps> = ({
  ticket,
  userData,
  onTicketUpdated,
  onTicketDeleted,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>(
    ticket.status_id.toString()
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);

  // Permissions
  const canEdit =
    userData.role === "admin" ||
    userData.role === "1" ||
    ticket.created_by === userData.id;
  const canDelete = userData.role === "admin" || userData.role === "1";
  const canChangeStatus = userData.role === "admin" || userData.role === "1";
  const isComercial = userData.role === "2";
  const isNoteType = ticket.type_name === "note";

  // Hide internal tickets from comercial users
  if (isComercial && ticket.is_internal) {
    return null;
  }

  const handleStatusChange = async () => {
    if (!ticket?.id || !selectedStatus) {
      console.error("No ticket ID or status available for status change");
      return;
    }

    const newStatusId = Number.parseInt(selectedStatus);
    setIsUpdatingStatus(true);

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

      setShowStatusDialog(false);
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
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!ticket?.id) {
      console.error("No ticket ID available for deletion");
      return;
    }

    setIsDeletingTicket(true);

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

      setShowDeleteDialog(false);
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
    } finally {
      setIsDeletingTicket(false);
    }
  };

  // Create status object for StatusBadge
  const statusForBadge: TicketStatus = {
    id: ticket.status_id,
    name: ticket.status_name || "abierto",
    sort_order: 0,
  };

  return (
    <>
      <div
        className={cn(
          "bg-white rounded-4xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200",
          className
        )}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 truncate">
                  {ticket.subject}
                </h3>
                {ticket.is_internal ? (
                  <Badge variant={"danger"}>Interno</Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  {ticket.created_by_name ||
                    ticket.created_by_email ||
                    "Usuario"}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {formatDateTime(ticket.created_at)}
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="h-3 w-3" />
                  {formatContext(ticket.context)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <StatusBadge status={statusForBadge} />
              <PriorityBadge priority={ticket.priority} />
              {(canEdit || canDelete || canChangeStatus) && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-48">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setShowReplies(true)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Ver conversación
                      </Button>
                      {canChangeStatus && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setShowStatusDialog(true)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Cambiar estado
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setShowDeleteDialog(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <div
            className={cn(
              "text-gray-700 leading-relaxed cursor-pointer transition-all duration-200",
              !isExpanded ? "line-clamp-3" : ""
            )}
            role="button"
            tabIndex={0}
            onClick={() => setIsExpanded(!isExpanded)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsExpanded(!isExpanded);
              }
            }}
          >
            {ticket.message}
          </div>

          {!isNoteType && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReplies(true)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {ticket.replies_count
                  ? `${ticket.replies_count} respuestas`
                  : "Responder"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const contextRoutes = {
                    tramite: `/tramites/${ticket.ref_id}`,
                    cliente: `/clients/${ticket.ref_id}`,
                    comparativa: `/comparativas/${ticket.ref_id}`,
                    fotovoltaica: `/fotovoltaica/${ticket.ref_id}`,
                  };
                  const route =
                    contextRoutes[ticket.context as keyof typeof contextRoutes];
                  if (route) {
                    window.open(route, "_blank");
                  }
                }}
                className="text-xs h-8 border-gray-200 hover:bg-gray-50"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Ver {formatContext(ticket.context)}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar Estado del Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Nuevo estado
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isUpdatingStatus}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowStatusDialog(false)}
                disabled={isUpdatingStatus}
              >
                Cancelar
              </Button>
              <Button onClick={handleStatusChange} disabled={isUpdatingStatus}>
                {isUpdatingStatus ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar este ticket? Esta acción no
              se puede deshacer.
            </p>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {ticket.subject}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Creado por {ticket.created_by_name || ticket.created_by_email}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeletingTicket}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeletingTicket}
              >
                {isDeletingTicket ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TicketRepliesSheet
        ticket={ticket}
        userData={userData}
        isOpen={showReplies}
        onOpenChange={setShowReplies}
        onTicketUpdated={onTicketUpdated}
      />
    </>
  );
};
