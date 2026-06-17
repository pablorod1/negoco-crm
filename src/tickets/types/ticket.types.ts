// ==================== TICKET SYSTEM TYPES ====================

export interface TicketType {
  id: number;
  name: string;
  description?: string;
}

export interface TicketStatus {
  id: number;
  name: string;
  sort_order: number;
}

export interface Ticket {
  id: number;
  subject: string;
  message: string;
  is_internal: boolean;
  status_id: number;
  status_name?: string;
  type_id: number;
  type_name?: string;
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  ref_id: string;
  priority: "low" | "medium" | "high" | "urgent";
  created_by: string;
  created_by_name?: string;
  created_by_email?: string;
  created_by_avatar?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at: string;
  replies_count?: number;
}

export interface TicketReply {
  id: number;
  ticket_id: number;
  message: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  author_avatar?: string;
  created_at: string;
}

export interface TicketVM extends Ticket {
  created_by_user?: {
    id: string;
    email: string;
    role: string;
    avatar?: string;
  };
}

export interface CreateTicketPayload {
  subject: string;
  message: string;
  is_internal?: boolean;
  type_id: number;
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  ref_id: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
}

export interface UpdateTicketPayload {
  subject?: string;
  message?: string;
  status_id?: number;
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
}

export interface CreateReplyPayload {
  message: string;
}

export interface TicketFilters {
  context?: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  ref_id?: string;
  status_id?: number;
  assigned_to?: string;
  created_by?: string;
  include_internal?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedTicketsResponse {
  tickets: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type TicketsApiResponse = ApiResponse<PaginatedTicketsResponse>;
export type TicketApiResponse = ApiResponse<Ticket>;
export type RepliesApiResponse = ApiResponse<TicketReply[]>;
export type ReplyApiResponse = ApiResponse<TicketReply>;

// ==================== COMPONENT PROPS TYPES ====================

export interface TicketListProps {
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  ref_id: string;
  canCreateInternal?: boolean;
  onTicketCreated?: (ticket: Ticket) => void;
  onTicketUpdated?: (ticket: Ticket) => void;
}

export interface TicketFormProps {
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  ref_id: string;
  canCreateInternal?: boolean;
  onTicketCreated?: (ticket: Ticket) => void;
  onCancel?: () => void;
}

export interface TicketDetailProps {
  ticket: Ticket;
  canEdit?: boolean;
  canChangeStatus?: boolean;
  canReply?: boolean;
  onTicketUpdated?: (ticket: Ticket) => void;
  onReplyAdded?: (reply: TicketReply) => void;
}

// ==================== CONSTANTS ====================

export const TICKET_PRIORITIES = {
  low: { value: "low", label: "Baja", color: "text-green-600" },
  medium: { value: "medium", label: "Media", color: "text-yellow-600" },
  high: { value: "high", label: "Alta", color: "text-orange-600" },
  urgent: { value: "urgent", label: "Urgente", color: "text-red-600" },
} as const;

const TICKET_CONTEXTS = {
  tramite: { value: "tramite", label: "Trámite" },
  cliente: { value: "cliente", label: "Cliente" },
  fotovoltaica: { value: "fotovoltaica", label: "Fotovoltaica" },
  comparativa: { value: "comparativa", label: "Comparativa" },
} as const;

export const DEFAULT_TICKET_STATUSES = {
  OPEN: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CLOSED: 4,
} as const;
