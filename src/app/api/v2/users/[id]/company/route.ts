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
 * Maintains identical functionality to /api/users/add/[id]/company
 * Uses POST method as per original specification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const { company } = await request.json();

    // EXACT SAME VALIDATION AS ORIGINAL
    if (!id || !company) {
      return NextResponse.json({
        success: false,
        error: "Missing parameters",
      });
    }

    const tursoClient = getTursoClient(request);

    // EXACT SAME ERROR MESSAGE AS ORIGINAL
    if (!tursoClient) {
      return NextResponse.json({
        success: false,
        error: "Error connecting to the database",
      });
    }

    // EXACT SAME QUERY AS ORIGINAL
    const res = await tursoClient.execute({
      sql: `UPDATE user SET company = ? WHERE id = ?`,
      args: [company, id],
    });

    // EXACT SAME RESPONSE HANDLING AS ORIGINAL
    if (res.rowsAffected === 0) {
      return NextResponse.json({
        success: false,
        error: "User not found",
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    // EXACT SAME ERROR HANDLING AS ORIGINAL
    console.error("Error adding company to user:", error);
    return NextResponse.json({
      success: false,
      error: "Error adding company to user",
    });
  }
}

/**
 * RESTful PATCH endpoint for company updates
 * Provides semantic HTTP method while maintaining functionality
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  // Delegate to POST method for consistent behavior
  return POST(request, { params });
}
