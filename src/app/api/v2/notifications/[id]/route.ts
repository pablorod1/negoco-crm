import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";

/**
 * Response interface for type safety
 */
interface SuccessResponse {
  success: boolean;
  error?: string;
}

/**
 * Deletes a specific notification by ID
 * @param request - Next.js request object
 * @param params - Route parameters containing the notification ID
 * @returns Promise<NextResponse<SuccessResponse>>
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse>> {
  try {
    const { id } = await params;

    // Validate notification ID
    const idValidation = z.string().min(1, "ID is required").safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid notification ID" },
        { status: 400 }
      );
    }

    // Get database client with error handling
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Delete notification with prepared statement
    const response = await tursoClient.execute({
      sql: `DELETE FROM notifications WHERE id = ?`,
      args: [id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        { success: false, error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /new_api/notifications/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
