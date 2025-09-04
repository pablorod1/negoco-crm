import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Client } from "@libsql/client";
import {
  validateUserSession,
  canAccessInternal,
  canChangeTicketStatus,
  canAssignTickets,
} from "@/core/auth/session-utils";
import { NOW_DATE } from "@/dashboard/constants";

// ==================== TYPE DEFINITIONS ====================

interface TicketData {
  id: number;
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
  data?: TicketData;
  error?: string;
}

// ==================== VALIDATION SCHEMAS ====================

const UpdateTicketSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(255, "Subject too long")
    .optional(),
  message: z.string().min(1, "Message is required").optional(),
  status_id: z.number().min(1).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigned_to: z.string().optional(),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Build the base query for tickets with joins
 */
const buildTicketsQuery = (): string => {
  return `
    SELECT 
      t.*,
      ts.name as status_name,
      tt.name as type_name,
      u1.name as created_by_name,
      u2.name as assigned_to_name
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
    LEFT JOIN ticket_types tt ON t.type_id = tt.id
    LEFT JOIN user u1 ON t.created_by = u1.id
    LEFT JOIN user u2 ON t.assigned_to = u2.id
  `;
};

/**
 * Check if user has access to the ticket
 */
const checkTicketAccess = async (
  ticketId: string,
  userId: string,
  userRole: string,
  tursoClient: Client
): Promise<{ hasAccess: boolean; ticket?: TicketData; error?: string }> => {
  try {
    // Get ticket details
    const ticketResult = await tursoClient.execute({
      sql: buildTicketsQuery() + " WHERE t.id = ?",
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

    // Role "2" can only access their own tickets
    if (userRole === "2") {
      const hasAccess =
        ticket.created_by === userId || ticket.assigned_to === userId;
      if (!hasAccess) {
        return { hasAccess: false, error: "Access denied" };
      }
    }

    return { hasAccess: true, ticket: ticket as unknown as TicketData };
  } catch (error) {
    console.error("Error checking ticket access:", error);
    return { hasAccess: false, error: "Database error" };
  }
};

// ==================== MAIN HANDLERS ====================

/**
 * GET /api/v2/tickets/[id]
 * Retrieves a specific ticket by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<TicketResponse>> {
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
    const accessCheck = await checkTicketAccess(
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

    return NextResponse.json({
      success: true,
      data: accessCheck.ticket as unknown as TicketData,
    });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v2/tickets/[id]
 * Updates a specific ticket
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<TicketResponse>> {
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

    const validation = UpdateTicketSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0]?.message || "Validation failed",
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // Initialize database connection
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Check ticket access
    const accessCheck = await checkTicketAccess(
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

    // Check permissions for specific operations
    if (updateData.status_id && !canChangeTicketStatus(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to change ticket status",
        },
        { status: 403 }
      );
    }

    if (updateData.assigned_to && !canAssignTickets(user.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions to assign tickets" },
        { status: 403 }
      );
    }

    // Validate status_id if provided
    if (updateData.status_id) {
      const statusCheck = await tursoClient.execute({
        sql: "SELECT id FROM ticket_statuses WHERE id = ?",
        args: [updateData.status_id],
      });

      if (statusCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Invalid status ID" },
          { status: 400 }
        );
      }
    }

    // Validate assigned_to user if provided
    if (updateData.assigned_to) {
      const userCheck = await tursoClient.execute({
        sql: "SELECT id FROM user WHERE id = ?",
        args: [updateData.assigned_to],
      });

      if (userCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Invalid assigned user" },
          { status: 400 }
        );
      }
    }

    // Build update query
    const updateFields: string[] = [];
    const updateParams: (string | number)[] = [];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateParams.push(value);
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    // Add updated timestamp
    updateParams.push(id);
    updateFields.push("updated_at = ?");
    updateParams.push(NOW_DATE.toISOString());

    // Execute update
    await tursoClient.execute({
      sql: `UPDATE tickets SET ${updateFields.join(", ")} WHERE id = ?`,
      args: updateParams,
    });

    // Get updated ticket
    const updatedTicket = await tursoClient.execute({
      sql: buildTicketsQuery() + " WHERE t.id = ?",
      args: [id],
    });

    return NextResponse.json({
      success: true,
      data: updatedTicket.rows[0] as unknown as TicketData,
    });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v2/tickets/[id]
 * Deletes a specific ticket (only for admin and role "1")
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: boolean; error?: string }>> {
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

    // Only admin and role "1" can delete tickets
    if (!canChangeTicketStatus(user.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions to delete tickets" },
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

    // Check if ticket exists
    const ticketCheck = await tursoClient.execute({
      sql: "SELECT id FROM tickets WHERE id = ?",
      args: [id],
    });

    if (ticketCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Delete ticket (this will cascade delete replies)
    await tursoClient.execute({
      sql: "DELETE FROM tickets WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
