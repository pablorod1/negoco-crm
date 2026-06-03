import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  validateUserSession,
  canChangeTicketStatus,
} from "@/core/auth/session-utils";
import { NOW_DATE } from "@/dashboard/constants";

// ==================== TYPE DEFINITIONS ====================

interface StatusResponse {
  success: boolean;
  data?: {
    id: number;
    status_id: number;
    status_name: string;
    updated_at: string;
  };
  error?: string;
}

// ==================== VALIDATION SCHEMAS ====================

const ChangeStatusSchema = z.object({
  status_id: z.number().min(1, "Status ID is required"),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Get valid status transitions
 */
const getValidTransitions = (): Record<number, number[]> => {
  return {
    1: [2, 3, 4], // open -> in_progress, resolved, closed
    2: [1, 3, 4], // in_progress -> open, resolved, closed
    3: [4], // resolved -> closed
    4: [1, 2], // closed -> open, in_progress
  };
};

/**
 * Check if status transition is valid
 */
const isValidTransition = (fromStatus: number, toStatus: number): boolean => {
  const validTransitions = getValidTransitions();
  return validTransitions[fromStatus]?.includes(toStatus) || false;
};

// ==================== MAIN HANDLER ====================

/**
 * PATCH /api/v2/tickets/[id]/status
 * Changes the status of a specific ticket
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<StatusResponse>> {
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

    // Check permissions
    if (!canChangeTicketStatus(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to change ticket status",
        },
        { status: 403 }
      );
    }

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

    const validation = ChangeStatusSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Validation failed",
        },
        { status: 400 }
      );
    }

    const { status_id } = validation.data;

    // Initialize database connection
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Check if ticket exists and get current status
    const ticketResult = await tursoClient.execute({
      sql: "SELECT id, status_id FROM tickets WHERE id = ?",
      args: [id],
    });

    if (ticketResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    const currentStatus = Number(ticketResult.rows[0].status_id);

    // Validate status exists
    const statusResult = await tursoClient.execute({
      sql: "SELECT id, name FROM ticket_statuses WHERE id = ?",
      args: [status_id],
    });

    if (statusResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid status ID" },
        { status: 400 }
      );
    }

    // Validate transition
    if (!isValidTransition(currentStatus, status_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid status transition" },
        { status: 400 }
      );
    }

    // Update ticket status
    await tursoClient.execute({
      sql: "UPDATE tickets SET status_id = ?, updated_at = ? WHERE id = ?",
      args: [status_id, NOW_DATE.toISOString(), id],
    });

    // Return updated ticket status
    return NextResponse.json({
      success: true,
      data: {
        id: Number(id),
        status_id,
        status_name: String(statusResult.rows[0].name),
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error changing ticket status:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
