import type React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
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
} from "@/core/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/core/components/ui/sheet";
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
  Send,
  X,
  StickyNote,
  AlertTriangle,
  Settings,
} from "lucide-react";
import CreateTicketDialog from "./CreateTicketDialog";
import { formatDateTime } from "@/core/utils/format";
import { formatTicketType } from "../utils/format";
import { TicketViewToggle, type TicketView } from "./TicketViewToggle";

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

const TicketRepliesSheet: React.FC<{
  ticket: Ticket;
  userData: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketUpdated: () => void;
}> = ({ ticket, userData, isOpen, onOpenChange, onTicketUpdated }) => {
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Check if ticket can receive replies
  const canReply =
    ticket.type_name !== "incidencia" ||
    (ticket.status_id !== DEFAULT_TICKET_STATUSES.CLOSED &&
      ticket.status_id !== DEFAULT_TICKET_STATUSES.RESOLVED);

  const loadReplies = useCallback(async () => {
    if (!ticket?.id) return;

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
  }, [ticket?.id]);
  const handleReplySubmit = async () => {
    if (!newReply.trim() || !ticket?.id) return;

    setIsSubmittingReply(true);
    try {
      const response = await fetch(`/api/v2/tickets/${ticket.id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // Auto-change status if needed
      if (
        ticket.status_id === DEFAULT_TICKET_STATUSES.OPEN &&
        userData.role !== "2"
      ) {
        await fetch(`/api/v2/tickets/${ticket.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status_id: DEFAULT_TICKET_STATUSES.IN_PROGRESS,
          }),
        });
        onTicketUpdated();
      }

      setNewReply("");
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
    } finally {
      setIsSubmittingReply(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReplies();
    }
  }, [isOpen, loadReplies]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReplySubmit();
    }
  };

  // Group messages by consecutive same author
  const groupMessages = useCallback(() => {
    const allMessages = [
      {
        id: `ticket-${ticket.id}`,
        message: ticket.message,
        author_id: ticket.created_by,
        author_name: ticket.created_by_name,
        author_email: ticket.created_by_email,
        author_avatar: ticket.created_by_avatar,
        created_at: ticket.created_at,
        isOriginal: true,
      },
      ...replies.map((reply) => ({
        id: `reply-${reply.id}`,
        message: reply.message,
        author_id: reply.author_id,
        author_name: reply.author_name,
        author_email: reply.author_email,
        author_avatar: reply.author_avatar,
        created_at: reply.created_at,
        isOriginal: false,
      })),
    ];

    const groups: Array<{
      author_id: string;
      author_name?: string;
      author_email?: string;
      author_avatar?: string;
      messages: Array<{
        id: string;
        message: string;
        created_at: string;
        isOriginal: boolean;
      }>;
      isOwnMessage: boolean;
    }> = [];

    allMessages.forEach((message) => {
      const isOwnMessage = message.author_id === userData.id;
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.author_id === message.author_id) {
        // Add to existing group
        lastGroup.messages.push({
          id: message.id,
          message: message.message,
          created_at: message.created_at,
          isOriginal: message.isOriginal,
        });
      } else {
        // Create new group
        groups.push({
          author_id: message.author_id,
          author_name: message.author_name,
          author_email: message.author_email,
          author_avatar: message.author_avatar,
          messages: [
            {
              id: message.id,
              message: message.message,
              created_at: message.created_at,
              isOriginal: message.isOriginal,
            },
          ],
          isOwnMessage,
        });
      }
    });

    return groups;
  }, [ticket, replies, userData.id]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] flex flex-col h-full">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 rounded-full"
            >
              <X size={16} />
            </Button>
            <div className="flex-1">
              <SheetTitle className="text-lg font-semibold text-left">
                {ticket.subject}
              </SheetTitle>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <Users size={14} />
                <span>{ticket.created_by_name}</span>
                <span>•</span>
                <span>{formatDateTime(ticket.created_at)}</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-4">
              {isLoadingReplies ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : (
                groupMessages().map((group, groupIndex) => (
                  <div
                    key={`group-${group.author_id}-${groupIndex}`}
                    className={cn(
                      "flex gap-3",
                      group.isOwnMessage ? "flex-row" : "flex-row-reverse"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
                        group.isOwnMessage ? "bg-blue-100" : "bg-gray-100"
                      )}
                    >
                      {group.isOwnMessage ? (
                        // Current user avatar
                        userData.image ? (
                          <Image
                            src={userData.image}
                            alt={userData.name || userData.email}
                            width={512}
                            height={512}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-blue-700">
                            {(userData.name || userData.email)
                              ?.charAt(0)
                              .toUpperCase()}
                          </span>
                        )
                      ) : // Other user avatar
                      group.author_avatar ? (
                        <Image
                          src={group.author_avatar}
                          alt={
                            group.author_name || group.author_email || "Usuario"
                          }
                          width={512}
                          height={512}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-700">
                          {(group.author_name || group.author_email)
                            ?.charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Messages */}
                    <div
                      className={cn(
                        "flex flex-col space-y-1 max-w-[70%]",
                        group.isOwnMessage ? "items-start" : "items-end"
                      )}
                    >
                      {group.messages.map((message, messageIndex) => (
                        <div key={message.id}>
                          <div
                            className={cn(
                              "px-4 py-2 rounded-2xl",
                              group.isOwnMessage
                                ? "bg-blue-600 text-white rounded-bl-md"
                                : "bg-gray-100 text-gray-900 rounded-tr-md",
                              // Special styling for original ticket message
                              message.isOriginal &&
                                group.isOwnMessage &&
                                "bg-blue-50 text-gray-900"
                            )}
                          >
                            <p className="text-sm leading-relaxed">
                              {message.message}
                            </p>
                          </div>
                          {/* Show timestamp only on last message of group or if significant time gap */}
                          {messageIndex === group.messages.length - 1 && (
                            <div
                              className={cn(
                                "text-xs text-gray-500 mt-1 px-1",
                                group.isOwnMessage ? "text-left" : "text-right"
                              )}
                            >
                              {group.isOwnMessage && (
                                <>
                                  <span>{group.author_name}</span>
                                  <span className="mx-1">•</span>
                                </>
                              )}
                              <span>{formatDateTime(message.created_at)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t p-4 bg-white">
            {canReply ? (
              <div className="flex gap-3 items-center">
                <textarea
                  rows={1}
                  placeholder="Escribe una respuesta..."
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSubmittingReply}
                  className="w-full resize-none px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50"
                />
                <Button
                  size="icon"
                  variant={"default"}
                  onClick={handleReplySubmit}
                  disabled={!newReply.trim() || isSubmittingReply}
                  className="rounded-full "
                >
                  {isSubmittingReply ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-8 h-8 " />
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CircleX size={16} />
                    <span className="text-sm font-medium">Ticket cerrado</span>
                  </div>
                  <p className="text-xs">
                    Este ticket está cerrado o resuelto y no permite nuevas
                    respuestas
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>(
    ticket.status_id.toString()
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);

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

  return (
    <div className="bg-white rounded-4xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {ticket.is_internal ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-100">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  Interno
                </div>
              ) : null}
              {!isNoteType ? (
                <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                  {ticket.subject}
                </h3>
              ) : null}
              {isNoteType ? (
                <h3 className="text-lg font-semibold text-gray-900 leading-tight flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  Nota Rápida
                </h3>
              ) : null}
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
            {!isNoteType ? (
              <StatusBadge
                status={{
                  id: ticket.status_id,
                  name: ticket.status_name || "",
                  sort_order: 0,
                }}
              />
            ) : null}
            {!isNoteType ? <PriorityBadge priority={ticket.priority} /> : null}
            {canEdit || canDelete ? (
              <>
                {/* Actions Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                    >
                      <MoreVertical size={16} className="text-gray-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2">
                    <div className="space-y-1">
                      {canChangeStatus && !isNoteType && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowStatusDialog(true)}
                          className="w-full justify-start h-9 text-gray-700 hover:bg-gray-50"
                        >
                          <Settings size={16} className="mr-2" />
                          Actualizar Estado
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDeleteDialog(true)}
                          className="w-full justify-start h-9 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={16} className="mr-2" />
                          {isNoteType ? "Eliminar Nota" : "Eliminar Ticket"}
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Status Update Dialog */}
                {canChangeStatus && !isNoteType && (
                  <Dialog
                    open={showStatusDialog}
                    onOpenChange={setShowStatusDialog}
                  >
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                          Actualizar Estado del Ticket
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">
                            Nuevo Estado
                          </label>
                          <Select
                            value={selectedStatus}
                            onValueChange={setSelectedStatus}
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
                        <div className="flex gap-3 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowStatusDialog(false);
                              setSelectedStatus(ticket.status_id.toString());
                            }}
                            className="flex-1"
                            disabled={isUpdatingStatus}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleStatusChange}
                            disabled={
                              isUpdatingStatus ||
                              selectedStatus === ticket.status_id.toString()
                            }
                            className="flex-1"
                          >
                            {isUpdatingStatus ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            ) : null}
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Delete Confirmation Dialog */}
                {canDelete && (
                  <Dialog
                    open={showDeleteDialog}
                    onOpenChange={setShowDeleteDialog}
                  >
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                          {isNoteType ? "Eliminar Nota" : "Eliminar Ticket"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="text-sm text-gray-600">
                          <p>
                            ¿Estás seguro de que quieres eliminar este{" "}
                            {isNoteType ? "nota" : "ticket"}? Esta acción no se
                            puede deshacer.
                          </p>
                          {!isNoteType && (
                            <p className="mt-2 font-medium">
                              Título:{" "}
                              <span className="font-normal">
                                {ticket.subject}
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            className="flex-1"
                            disabled={isDeletingTicket}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeletingTicket}
                            className="flex-1"
                          >
                            {isDeletingTicket ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            ) : null}
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "text-gray-700 leading-relaxed cursor-pointer transition-all duration-200",
            !isExpanded ? "line-clamp-3" : ""
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {ticket.message}
        </div>

        {!isNoteType ? (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MessageSquare size={14} />
              <span>{ticket.replies_count || 0} respuestas</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplies(true)}
              className="h-9 px-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
            >
              <Reply size={16} />
              <span className="ml-2">Ver conversación</span>
            </Button>
          </div>
        ) : null}
      </div>

      <TicketRepliesSheet
        ticket={ticket}
        userData={userData}
        isOpen={showReplies}
        onOpenChange={setShowReplies}
        onTicketUpdated={onTicketUpdated}
      />
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
  const [activeView, setActiveView] = useState<TicketView>("incidencias");
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

  // Separate tickets by type
  const incidencias = useMemo(() => {
    return filteredTickets.filter((ticket) => ticket.type_name !== "note");
  }, [filteredTickets]);

  const notas = useMemo(() => {
    return filteredTickets.filter((ticket) => ticket.type_name === "note");
  }, [filteredTickets]);

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
          defaultType={activeView === "notas" ? "note" : "incidencia"}
          onTicketCreated={handleTicketCreated}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <TicketViewToggle
          currentView={activeView}
          onViewChange={setActiveView}
          incidenciasCount={incidencias.length}
          notasCount={notas.length}
        />

        {/* Filtros - Solo visibles para incidencias */}
        {activeView === "incidencias" && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <Filter size={16} className="text-gray-600" />
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  Filtros
                </span>
              </div>
              <Select
                value={filter.status_id?.toString() || "all"}
                onValueChange={(value) =>
                  setFilter({
                    ...filter,
                    status_id:
                      value === "all" ? undefined : Number.parseInt(value),
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
                  <SelectItem
                    value={DEFAULT_TICKET_STATUSES.RESOLVED.toString()}
                  >
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
                      setFilter({
                        ...filter,
                        include_internal: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-50 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  Incluir tickets internos
                </label>
              )}
            </div>
          </div>
        )}

        {/* Checkbox para tickets internos - solo para vista de notas */}
        {activeView === "notas" && !isComercial && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <Filter size={16} className="text-gray-600" />
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter.include_internal}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      include_internal: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 bg-gray-50 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                Incluir tickets internos
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Contenido condicional basado en la vista activa */}
      <div className="space-y-4">
        {activeView === "incidencias" ? (
          // Vista de Incidencias
          isLoading ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-3 text-gray-500">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-sm font-medium">
                  Cargando incidencias...
                </span>
              </div>
            </div>
          ) : incidencias.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No hay incidencias
              </h3>
              <p className="text-gray-600 mb-6 max-w-sm mx-auto leading-relaxed">
                No se encontraron incidencias para este {context}. Crea la
                primera incidencia para comenzar.
              </p>
              <CreateTicketDialog
                context={context}
                refId={refId}
                userData={userData}
                assignedTo={assignedTo}
                defaultType="incidencia"
                onTicketCreated={handleTicketCreated}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {incidencias.map((ticket) => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  userData={userData}
                  onTicketUpdated={handleTicketUpdated}
                  onTicketDeleted={handleTicketDeleted}
                />
              ))}
            </div>
          )
        ) : // Vista de Notas
        isLoading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3 text-gray-500">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Cargando notas...</span>
            </div>
          </div>
        ) : notas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <StickyNote size={32} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No hay notas
            </h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto leading-relaxed">
              No se encontraron notas rápidas para este {context}. Crea la
              primera nota para comenzar.
            </p>
            <CreateTicketDialog
              context={context}
              refId={refId}
              userData={userData}
              assignedTo={assignedTo}
              defaultType="note"
              onTicketCreated={handleTicketCreated}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {notas.map((ticket) => (
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
