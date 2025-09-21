import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { z } from "zod";

// Request Validation Schema
const TeamMembersParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

// Response Types
interface TeamMembersResponse {
  success: true;
  ids: string[];
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Retrieves team members (subcomerciales) for a given user ID (RESTful GET)
 * @param request - Next.js request object
 * @param params - Route parameters containing user ID
 * @returns Promise<NextResponse<TeamMembersResponse | ErrorResponse>>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<TeamMembersResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Validate parameters
    const validation = TeamMembersParamsSchema.safeParse({ id });
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

    // Optimized query with prepared statement and index usage
    const response = await tursoClient.execute({
      sql: "SELECT id FROM user WHERE super_id = ? ORDER BY created_at DESC",
      args: [id],
    });

    if (response.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No subcomerciales found",
      });
    }

    const ids = response.rows.map((row) => String(row.id));
    return NextResponse.json({
      success: true,
      ids,
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching team members",
      },
      { status: 500 }
    );
  }
}

/**
 * Legacy POST endpoint for backward compatibility
 * Maintains identical functionality to the original /api/users/get/[id]/subcomerciales route
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<TeamMembersResponse | ErrorResponse>> {
  // Delegate to GET method for backward compatibility
  return GET(request, { params });
}
