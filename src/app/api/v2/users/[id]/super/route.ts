import { getTursoClient } from "@/core/libsql/client";
import { NextRequest, NextResponse } from "next/server";

// Response Types
interface SuccessResponse {
  success: true;
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * EXACT BACKWARD COMPATIBILITY ENDPOINT
 * Maintains identical functionality to /api/users/add/[id]/super
 * Uses PATCH method as per original specification
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id: user_id } = await params;
    const { super_id } = await request.json();

    // EXACT SAME VALIDATION AS ORIGINAL
    if (!user_id || !super_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);

    // EXACT SAME ERROR HANDLING AS ORIGINAL
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // EXACT SAME QUERY AS ORIGINAL
    const response = await tursoClient.execute({
      sql: `UPDATE user SET super_id = ? WHERE id = ?`,
      args: [super_id, user_id],
    });

    // EXACT SAME RESPONSE HANDLING AS ORIGINAL
    if (response.rowsAffected === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No se ha encontrado el usuario",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    // EXACT SAME ERROR HANDLING AS ORIGINAL
    console.error("Error adding super user:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error adding super user",
      },
      { status: 500 }
    );
  }
}
