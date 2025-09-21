import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/core/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/core/components/ui/sheet";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { Button } from "@/core/components/ui/button";
import { Textarea } from "@/core/components/ui/textarea";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/core/components/ui/avatar";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import {
  CircleCheck,
  CircleX,
  Send,
  MessageSquare,
  User,
  Clock,
} from "lucide-react";
import {
  Ticket,
  TicketReply,
  DEFAULT_TICKET_STATUSES,
  TicketStatus,
} from "@/tickets/types/ticket.types";
import { showCustomToast } from "@/core/components/CustomToast";
import { UserType } from ".";

interface TicketRepliesSheetProps {
  ticket: Ticket;
  userData: UserType;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketUpdated: () => void;
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

export const TicketRepliesSheet: React.FC<TicketRepliesSheetProps> = ({
  ticket,
  userData,
  isOpen,
  onOpenChange,
  onTicketUpdated,
}) => {
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

  // Create status object for StatusBadge
  const statusForBadge: TicketStatus = {
    id: ticket.status_id,
    name: ticket.status_name || "abierto",
    sort_order: 0,
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] flex flex-col h-full">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <div className="flex-1 min-w-0">
              <SheetTitle className="font-semibold text-gray-900 truncate">
                {ticket.subject}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={statusForBadge} />
                <PriorityBadge priority={ticket.priority} />
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-4 py-4">
            {isLoadingReplies ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">
                  Cargando conversación...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupMessages().map((group, groupIndex) => (
                  <div
                    key={`group-${group.author_id}-${groupIndex}`}
                    className={cn(
                      "flex gap-3",
                      group.isOwnMessage ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={group.author_avatar} />
                      <AvatarFallback className="text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "flex-1 space-y-2",
                        group.isOwnMessage ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "text-xs text-gray-500 px-1",
                          group.isOwnMessage ? "text-right" : "text-left"
                        )}
                      >
                        {group.author_name || group.author_email} •{" "}
                        {formatDateTime(group.messages[0].created_at)}
                      </div>
                      {group.messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed",
                            group.isOwnMessage
                              ? "bg-blue-600 text-white ml-auto"
                              : "bg-gray-100 text-gray-900",
                            message.isOriginal &&
                              "ring-2 ring-blue-200 ring-opacity-50"
                          )}
                        >
                          <div
                            className="whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{
                              __html: message.message.replace(/\n/g, "<br>"),
                            }}
                          />
                          {group.messages.length > 1 &&
                            message !==
                              group.messages[group.messages.length - 1] && (
                              <div className="text-xs opacity-50 mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDateTime(message.created_at)}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Reply Input */}
          <div className="border-t p-4 bg-white">
            {canReply ? (
              <div className="flex items-center gap-3">
                <Textarea
                  placeholder="Escribe tu respuesta..."
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="flex-1 min-h-none resize-none border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                  disabled={isSubmittingReply}
                />
                <Button
                  onClick={handleReplySubmit}
                  disabled={!newReply.trim() || isSubmittingReply}
                  size="icon"
                >
                  {isSubmittingReply ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Esta conversación está cerrada</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
