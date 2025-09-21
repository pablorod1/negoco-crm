import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Request Validation Schema
const PasswordResetParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

// Response Types
interface SuccessResponse {
  success: true;
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Updates user password reset flag
 * This endpoint resets the should_reset_password flag for a user
 * @param request - Next.js request object
 * @param params - Route parameters containing user ID
 * @returns Promise<NextResponse<SuccessResponse | ErrorResponse>>
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Validate parameters
    const validation = PasswordResetParamsSchema.safeParse({ id });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Invalid parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Update password reset flag with prepared statement
    const response = await tursoClient.execute({
      sql: `UPDATE user SET should_reset_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [id],
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating password reset flag:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error updating password reset flag",
      },
      { status: 500 }
    );
  }
}
