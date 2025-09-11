// Shared ticket components
export { StatusBadge } from "./StatusBadge";
export { PriorityBadge } from "./PriorityBadge";
export { TicketRepliesSheet } from "./TicketRepliesSheet";
export { TicketItem } from "./TicketItem";

// Re-export types
export type {
  Ticket,
  TicketReply,
  TicketStatus,
  TicketType,
} from "@/tickets/types/ticket.types";
export type { User as UserType } from "@/core/types";
