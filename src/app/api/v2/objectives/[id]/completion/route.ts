import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";

// ===== TYPE DEFINITIONS =====

interface ObjectiveResponse {
  success: boolean;
  error?: string;
}

// ===== ZOD VALIDATION SCHEMAS =====

const ObjectiveIdSchema = z.object({
  id: z.string().min(1),
});

/**
 * Marks an objective as completed
 * @param request - Next.js request object
 * @param params - Route parameters containing the objective ID
 * @returns Promise<NextResponse<ObjectiveResponse>>
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ObjectiveResponse>> {
  try {
    const { id } = await params;

    // Validate route parameters
    const validation = ObjectiveIdSchema.safeParse({ id });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid objective ID",
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

    // Execute update with prepared statement
    const result = await tursoClient.execute({
      sql: `UPDATE objectives SET completed = 1 WHERE id = ?`,
      args: [id],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Objective not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error marking objective as completed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
