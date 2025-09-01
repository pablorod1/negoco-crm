import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { z } from "zod";

// Request Validation Schema
const GetUserParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

// Response Types
interface UserResponse {
  success: true;
  data: {
    id: string;
    email: string;
    email_verified: boolean;
    name: string;
    created_at: string;
    updated_at: string;
    banned: boolean;
    image: string | null;
    role: string;
    super_id: string | null;
    should_reset_password: boolean;
    notifications: number;
    company: string | null;
    organization: {
      id: string;
      name: string;
      logo: string | null;
      plan: string | null;
    };
  };
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Retrieves a user by their ID with organization and notification data
 * @param request - Next.js request object
 * @param params - Route parameters containing user ID
 * @returns Promise<NextResponse<UserResponse | ErrorResponse>>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<UserResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Validate parameters
    const validation = GetUserParamsSchema.safeParse({ id });
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

    // Optimized query with prepared statement - MAINTAINS ORIGINAL FUNCTIONALITY
    const response = await tursoClient.execute({
      sql: `SELECT 
        u.*,
        o.id as org_id,
        o.name as org_name,
        o.logo as org_logo,
        o.plan as org_plan,
        COUNT(n.id) as notifications
      FROM user u
      INNER JOIN member m ON u.id = m.user_id
      INNER JOIN organization o ON m.organization_id = o.id
      LEFT JOIN notifications n ON u.id = n.user_id
      WHERE u.id = ?
      GROUP BY u.id, o.id, o.name, o.logo, o.plan`,
      args: [id],
    });

    if (response.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    const row = response.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        id: String(row.id),
        email: String(row.email),
        email_verified: Boolean(row.email_verified),
        name: String(row.name),
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        banned: Boolean(row.banned),
        image: row.image ? String(row.image) : null,
        role: String(row.role),
        super_id: row.super_id ? String(row.super_id) : null,
        should_reset_password: Boolean(row.should_reset_password),
        notifications: Number(row.notifications) || 0,
        company: row.company ? String(row.company) : null,
        organization: {
          id: row.org_id ? String(row.org_id) : "",
          name: row.org_name ? String(row.org_name) : "",
          logo: row.org_logo ? String(row.org_logo) : null,
          plan: row.org_plan ? String(row.org_plan) : null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

/**
 * Legacy POST endpoint for backward compatibility
 * Maintains identical functionality to the original /api/users/get/[id] route
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<UserResponse | ErrorResponse>> {
  // Delegate to GET method for backward compatibility
  return GET(request, { params });
}
