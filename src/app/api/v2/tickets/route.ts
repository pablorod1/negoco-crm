import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";
import {
  validateUserSession,
  canAccessInternal,
  AuthenticatedUser,
} from "@/core/auth/session-utils";
import { NOW_DATE } from "@/dashboard/constants";
import { ServerNotificationsService } from "@/core/services/serverNotificationsService";
import { generateTicketCreatedNotification } from "@/core/utils/notifications.helpers";

// ==================== TYPE DEFINITIONS ====================

interface TicketData {
  id: string;
  subject: string;
  message: string;
  is_internal: boolean;
  status_id: number;
  status_name?: string;
  type_id: number;
  type_name?: string;
  context: string;
  ref_id: string;
  priority: string;
  created_by: string;
  created_by_name?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at: string;
}

interface TicketResponse {
  success: boolean;
  data?:
    | TicketData
    | TicketData[]
    | { tickets: TicketData[]; pagination: PaginationData };
  error?: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ==================== VALIDATION SCHEMAS ====================

const CreateTicketSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(255, "Subject too long"),
  message: z.string().min(1, "Message is required"),
  is_internal: z.boolean().default(false),
  type_id: z.number().min(1, "Type ID is required"),
  context: z.enum(["tramite", "cliente", "fotovoltaica", "comparativa"]),
  ref_id: z.string().min(1, "Reference ID is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assigned_to: z.string().optional(),
});

const GetTicketsQuerySchema = z.object({
  context: z
    .enum(["tramite", "cliente", "fotovoltaica", "comparativa"])
    .optional(),
  ref_id: z.string().optional(),
  status_id: z.number().optional(),
  assigned_to: z.string().optional(),
  created_by: z.string().optional(),
  type_id: z.number().optional(),
  include_internal: z.boolean().default(false),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if a user has comercial role (role "2")
 */
const isUserComercial = async (
  userId: string,
  tursoClient: Client
): Promise<boolean> => {
  try {
    const userResult = await tursoClient.execute({
      sql: "SELECT role FROM user WHERE id = ?",
      args: [userId],
    });

    return userResult.rows[0]?.role === "2";
  } catch (error) {
    console.error("Error checking user role:", error);
    return false;
  }
};

/**
 * Get client name from context for notification
 */
const getClientNameFromContext = async (
  context: string,
  refId: string,
  tursoClient: Client
): Promise<string | undefined> => {
  try {
    let query = "";

    switch (context) {
      case "tramite":
        query = "SELECT client FROM tramites WHERE id = ?";
        break;
      case "comparativa":
        query = "SELECT client FROM comparativas WHERE id = ?";
        break;
      case "fotovoltaica":
        query = "SELECT client FROM fotovoltaica WHERE id = ?";
        break;
      case "cliente":
        query =
          "SELECT CONCAT(name, ' ', COALESCE(last_name, '')) as client FROM clientes WHERE id = ?";
        break;
      default:
        return undefined;
    }

    const result = await tursoClient.execute({
      sql: query,
      args: [refId],
    });

    return result.rows[0]?.client as string | undefined;
  } catch (error) {
    console.error("Error getting client name from context:", error);
    return undefined;
  }
};

/**
 * Filter tickets based on user role and permissions
 */
const filterTicketsByRole = (
  user: AuthenticatedUser,
  whereConditions: string[],
  params: (string | number | boolean)[]
): void => {
  // Role "2" (comercial) can only see their own tickets
  if (user.role === "2") {
    whereConditions.push("(t.created_by = ? OR t.assigned_to = ?)");
    params.push(user.id, user.id);
  }

  // Note: Internal tickets filtering is handled explicitly via include_internal parameter
};

/**
 * Build the base query for tickets with joins
 */
const buildTicketsQuery = (whereConditions: string[] = []): string => {
  let query = `
    SELECT 
      t.*,
      ts.name as status_name,
      tt.name as type_name,
      u1.name as created_by_name,
      u2.name as assigned_to_name,
      COUNT(tr.id) as replies_count
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
    LEFT JOIN ticket_types tt ON t.type_id = tt.id
    LEFT JOIN user u1 ON t.created_by = u1.id
    LEFT JOIN user u2 ON t.assigned_to = u2.id
    LEFT JOIN ticket_replies tr ON t.id = tr.ticket_id
  `;

  if (whereConditions.length > 0) {
    query += " WHERE " + whereConditions.join(" AND ");
  }

  query += " GROUP BY t.id, ts.name, tt.name, u1.name, u2.name";

  return query;
}; // ==================== MAIN HANDLERS ====================

/**
 * GET /api/v2/tickets
 * Retrieves tickets with filtering and pagination
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<TicketResponse>> {
  try {
    // Validate authentication
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = authResult.user;

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);

    // Convert string parameters to appropriate types
    const parsedQuery = {
      ...queryParams,
      status_id: queryParams.status_id
        ? parseInt(queryParams.status_id)
        : undefined,
      page: queryParams.page ? parseInt(queryParams.page) : 1,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 20,
      include_internal: queryParams.include_internal === "true",
      type_id: queryParams.type_id ? parseInt(queryParams.type_id) : undefined,
    };

    const validation = GetTicketsQuerySchema.safeParse(parsedQuery);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            validation.error.errors[0]?.message || "Invalid query parameters",
        },
        { status: 400 }
      );
    }

    const query = validation.data;

    // Initialize database connection
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Build query conditions
    const whereConditions: string[] = [];
    const params: (string | number | boolean)[] = [];

    // Apply role-based filtering
    filterTicketsByRole(user, whereConditions, params);

    // Apply query filters
    if (query.context) {
      whereConditions.push("t.context = ?");
      params.push(query.context);
    }

    if (query.ref_id) {
      whereConditions.push("t.ref_id = ?");
      params.push(query.ref_id);
    }

    if (query.status_id) {
      whereConditions.push("t.status_id = ?");
      params.push(query.status_id);
    }

    if (query.assigned_to) {
      whereConditions.push("t.assigned_to = ?");
      params.push(query.assigned_to);
    }

    if (query.created_by) {
      whereConditions.push("t.created_by = ?");
      params.push(query.created_by);
    }

    if (query.type_id) {
      whereConditions.push("t.type_id = ?");
      params.push(query.type_id);
    }

    // Apply include_internal filter
    // Users without internal access (like comercial users) cannot see internal tickets regardless of the filter
    if (!query.include_internal || !canAccessInternal(user.role)) {
      whereConditions.push("t.is_internal = 0");
    }

    // Build final query
    let baseQuery = buildTicketsQuery(whereConditions);

    baseQuery += " ORDER BY t.created_at DESC";

    // Add pagination
    const offset = (query.page - 1) * query.limit;
    baseQuery += " LIMIT ? OFFSET ?";
    params.push(query.limit, offset);
    console.log("Final Query:", baseQuery, params);
    // Execute query
    const result = await tursoClient.execute({
      sql: baseQuery,
      args: params,
    });

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM tickets t";
    if (whereConditions.length > 0) {
      countQuery += " WHERE " + whereConditions.join(" AND ");
    }

    const countResult = await tursoClient.execute({
      sql: countQuery,
      args: params.slice(0, -2), // Remove LIMIT and OFFSET params
    });

    const total = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.ceil(total / query.limit);

    return NextResponse.json({
      success: true,
      data: {
        tickets: result.rows as unknown as TicketData[],
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/tickets
 * Creates a new ticket
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<TicketResponse>> {
  try {
    // Validate authentication
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = authResult.user;

    // Parse and validate request body
    let requestBody: Record<string, unknown>;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const validation = CreateTicketSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0]?.message || "Validation failed",
        },
        { status: 400 }
      );
    }

    const ticketData = validation.data;

    // Check internal permission
    if (ticketData.is_internal && !canAccessInternal(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to create internal tickets",
        },
        { status: 403 }
      );
    }

    // Initialize database connection
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Validate that ticket type exists
    const typeCheck = await tursoClient.execute({
      sql: "SELECT id FROM ticket_types WHERE id = ?",
      args: [ticketData.type_id],
    });

    if (typeCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid ticket type" },
        { status: 400 }
      );
    }

    // Validate assigned_to user if provided
    if (ticketData.assigned_to) {
      const userCheck = await tursoClient.execute({
        sql: "SELECT id FROM user WHERE id = ?",
        args: [ticketData.assigned_to],
      });

      if (userCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Invalid assigned user" },
          { status: 400 }
        );
      }
    }

    // Create ticket with default status (1 = open)
    const insertResult = await tursoClient.execute({
      sql: `
        INSERT INTO tickets (
          id, subject, message, is_internal, status_id, type_id, 
          context, ref_id, priority, created_by, assigned_to,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        ticketData.subject,
        ticketData.message,
        ticketData.is_internal,
        ticketData.type_id,
        ticketData.context,
        ticketData.ref_id,
        ticketData.priority,
        user.id,
        ticketData.assigned_to || null,
        NOW_DATE.toISOString(),
        NOW_DATE.toISOString(),
      ],
    });

    // Get the created ticket with full details
    const ticketId = Number(insertResult.lastInsertRowid);
    const createdTicket = await tursoClient.execute({
      sql: buildTicketsQuery([`t.id = ?`]),
      args: [ticketId],
    });

    const ticket = createdTicket.rows[0] as unknown as TicketData;

    // Send notification if ticket is assigned to someone other than the creator
    if (ticketData.assigned_to && ticketData.assigned_to !== user.id) {
      // Skip internal tickets notification for comercial users (role "2")
      const shouldSendNotification = !(
        ticketData.is_internal &&
        (await isUserComercial(ticketData.assigned_to, tursoClient))
      );

      if (shouldSendNotification) {
        try {
          // Get client name for notification context (optional)
          const clientName = await getClientNameFromContext(
            ticketData.context,
            ticketData.ref_id,
            tursoClient
          );

          const notification = generateTicketCreatedNotification({
            subject: ticketData.subject,
            context: ticketData.context,
            ref_id: ticketData.ref_id,
            user_id: ticketData.assigned_to,
            client: clientName,
            created_by_name: user.name,
          });

          await ServerNotificationsService.create(notification, tursoClient);
        } catch (notificationError) {
          console.error(
            "Error sending ticket creation notification:",
            notificationError
          );
          // Don't fail the ticket creation if notification fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
