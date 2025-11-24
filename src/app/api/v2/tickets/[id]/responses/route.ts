import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";
import {
  validateUserSession,
  canAccessInternal,
} from "@/core/auth/session-utils";
import { NOW_DATE } from "@/dashboard/constants";
import { ServerNotificationsService } from "@/core/services/serverNotificationsService";
import { generateTicketReplyNotification } from "@/core/utils/notifications.helpers";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

// ==================== TYPE DEFINITIONS ====================

interface ReplyData {
  id: number;
  ticket_id: number;
  message: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  author_avatar?: string;
  author_role?: string;
  author_is_active?: boolean;
  created_at: string;
}

interface ReplyResponse {
  success: boolean;
  data?: ReplyData | ReplyData[];
  error?: string;
}

// ==================== VALIDATION SCHEMAS ====================

const CreateReplySchema = z.object({
  message: z.string().min(1, "Message is required"),
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
        query = `
          SELECT c.name as client
          FROM tramites t 
          JOIN clients c ON t.client_id = c.id
          WHERE t.id = ?
        `;
        break;
      case "comparativa":
        query = "SELECT client FROM comparativas WHERE id = ?";
        break;
      case "fotovoltaica":
        query = "SELECT client FROM fotovoltaica WHERE id = ?";
        break;
      case "cliente":
        query =
          "SELECT CONCAT(name, ' ', COALESCE(last_name, '')) as client FROM clients WHERE id = ?";
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
 * Build the base query for replies with joins
 */
const buildRepliesQuery = (): string => {
  return `
    SELECT 
      r.*,
      u.name as author_name,
      u.email as author_email,
      u.image as author_avatar,
      u.role as author_role
    FROM ticket_replies r
    LEFT JOIN user u ON r.author_id = u.id
  `;
};

/**
 * Check if user has access to the ticket for adding replies
 */
const checkTicketAccessForReply = async (
  ticketId: string,
  userId: string,
  userRole: string,
  tursoClient: Client
): Promise<{
  hasAccess: boolean;
  ticket?: Record<string, unknown>;
  error?: string;
}> => {
  try {
    // Get ticket details
    const ticketResult = await tursoClient.execute({
      sql: "SELECT * FROM tickets WHERE id = ?",
      args: [ticketId],
    });

    if (ticketResult.rows.length === 0) {
      return { hasAccess: false, error: "Ticket not found" };
    }

    const ticket = ticketResult.rows[0];

    // Check if ticket is internal and user has no access
    if (ticket.is_internal && !canAccessInternal(userRole)) {
      return { hasAccess: false, error: "Access denied to internal ticket" };
    }

    // Role "2" can access their own tickets and those of their subcomerciales
    if (userRole === "2") {
      let hasAccess =
        ticket.created_by === userId || ticket.assigned_to === userId;

      // If not direct access, check subcomerciales
      if (!hasAccess) {
        const subcomercialesRes = await getSubcomerciales(tursoClient, userId);
        if (
          subcomercialesRes.success &&
          subcomercialesRes.ids &&
          subcomercialesRes.ids.length > 0
        ) {
          hasAccess =
            subcomercialesRes.ids.includes(ticket.created_by as string) ||
            subcomercialesRes.ids.includes(ticket.assigned_to as string);
        }
      }

      if (!hasAccess) {
        return { hasAccess: false, error: "Access denied" };
      }
    }

    return { hasAccess: true, ticket };
  } catch (error) {
    console.error("Error checking ticket access:", error);
    return { hasAccess: false, error: "Database error" };
  }
};

// ==================== MAIN HANDLERS ====================

/**
 * GET /api/v2/tickets/[id]/responses
 * Retrieves all replies for a specific ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ReplyResponse>> {
  try {
    const { id } = await params;

    // Validate authentication
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = authResult.user;

    // Initialize database connection
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Check ticket access
    const accessCheck = await checkTicketAccessForReply(
      id,
      user.id,
      user.role,
      tursoClient
    );
    if (!accessCheck.hasAccess) {
      const status = accessCheck.error === "Ticket not found" ? 404 : 403;
      return NextResponse.json(
        { success: false, error: accessCheck.error },
        { status }
      );
    }

    // Get all replies for the ticket
    const repliesResult = await tursoClient.execute({
      sql:
        buildRepliesQuery() +
        " WHERE r.ticket_id = ? ORDER BY r.created_at ASC",
      args: [id],
    });

    return NextResponse.json({
      success: true,
      data: repliesResult.rows as unknown as ReplyData[],
    });
  } catch (error) {
    console.error("Error fetching ticket replies:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/tickets/[id]/responses
 * Creates a new reply for a specific ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ReplyResponse>> {
  try {
    const { id: ticket_id } = await params;
    const id = crypto.randomUUID();
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

    const validation = CreateReplySchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0]?.message || "Validation failed",
        },
        { status: 400 }
      );
    }

    const { message } = validation.data;

    // Initialize database connection
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Check ticket access
    const accessCheck = await checkTicketAccessForReply(
      ticket_id,
      user.id,
      user.role,
      tursoClient
    );
    if (!accessCheck.hasAccess) {
      const status = accessCheck.error === "Ticket not found" ? 404 : 403;
      return NextResponse.json(
        { success: false, error: accessCheck.error },
        { status }
      );
    }

    // Create the reply
    const insertResult = await tursoClient.execute({
      sql: `
        INSERT INTO ticket_replies (id, ticket_id, message, author_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [id, ticket_id, message, user.id, NOW_DATE.toISOString()],
    });

    // Get the created reply with author details
    const replyId = Number(insertResult.lastInsertRowid);
    const createdReply = await tursoClient.execute({
      sql: buildRepliesQuery() + " WHERE r.id = ?",
      args: [replyId],
    });

    // Update ticket's updated_at timestamp
    await tursoClient.execute({
      sql: "UPDATE tickets SET updated_at = ? WHERE id = ?",
      args: [NOW_DATE.toISOString(), ticket_id],
    });

    // Send notifications for the reply
    const ticket = accessCheck.ticket;
    if (ticket) {
      const usersToNotify = new Set<string>();

      // Add created_by if different from reply author
      if (ticket.created_by && ticket.created_by !== user.id) {
        usersToNotify.add(ticket.created_by as string);
      }

      // Add assigned_to if different from reply author
      if (ticket.assigned_to && ticket.assigned_to !== user.id) {
        usersToNotify.add(ticket.assigned_to as string);
      }

      // Send notifications to relevant users
      for (const userId of usersToNotify) {
        try {
          // Skip internal tickets notification for comercial users (role "2")
          const shouldSendNotification = !(
            ticket.is_internal && (await isUserComercial(userId, tursoClient))
          );

          if (shouldSendNotification) {
            // Get client name for notification context (optional)
            const clientName = await getClientNameFromContext(
              ticket.context as string,
              ticket.ref_id as string,
              tursoClient
            );

            const notification = generateTicketReplyNotification({
              ticket_id: ticket_id,
              subject: ticket.subject as string,
              context: ticket.context as string,
              ref_id: ticket.ref_id as string,
              user_id: userId,
              client: clientName,
              author_name: user.name,
            });

            await ServerNotificationsService.create(notification, tursoClient);
          }
        } catch (notificationError) {
          console.error(
            "Error sending ticket reply notification:",
            notificationError
          );
          // Don't fail the reply creation if notification fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: createdReply.rows[0] as unknown as ReplyData,
    });
  } catch (error) {
    console.error("Error creating ticket reply:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
