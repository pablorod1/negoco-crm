import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { z } from "zod";

// Request Validation Schemas
const GetAllUsersParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

// GET query schema
const GetAllUsersQuerySchema = z.object({
  role: z.string().min(1, "Role is required"),
});

// Response Types
interface User {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  created_at: string;
  updated_at: string;
  image: string | null;
  role: string;
  banned: boolean;
  ban_reason: string | null;
  ban_expires: string | null;
  super_id: string | null;
  should_reset_password: boolean;
  company: string | null;
  last_login: string | null;
  organization: {
    id: string;
    name: string;
    logo: string | null;
  };
}

interface UsersResponse {
  success: true;
  data: User[];
}

interface ErrorResponse {
  success: false;
  error: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<UsersResponse | ErrorResponse>> {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { role } = GetAllUsersQuerySchema.parse({
      role: searchParams.get("role"),
    });

    // Validate path param
    const paramsValidation = GetAllUsersParamsSchema.safeParse({ id });
    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
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

    // Query logic (unchanged)
    let query = `
      SELECT u.*, o.id as org_id, o.name as org_name, o.logo as org_logo, s.created_at as last_login
      FROM user u 
      INNER JOIN member m ON u.id = m.user_id
      INNER JOIN organization o ON m.organization_id = o.id
      LEFT JOIN session s ON u.id = s.user_id AND s.created_at = (
        SELECT MAX(created_at) FROM session WHERE user_id = u.id
      )
    `;

    const queryParams: (string | number)[] = [];

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` WHERE u.id = ? OR u.id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")})`;
        queryParams.push(id, ...subcomerciales.ids);
      } else {
        query += ` WHERE u.id = ?`;
        queryParams.push(id);
      }
    }

    const response = await tursoClient.execute({
      sql: query,
      args: queryParams,
    });

    const mappedData = response.rows.map(
      (row): User => ({
        id: String(row.id),
        email: String(row.email),
        email_verified: Boolean(row.email_verified),
        name: String(row.name),
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        image: row.image ? String(row.image) : null,
        role: String(row.role),
        banned: Boolean(row.banned),
        ban_reason: row.ban_reason ? String(row.ban_reason) : null,
        ban_expires: row.ban_expires as string | null,
        super_id: row.super_id ? String(row.super_id) : null,
        should_reset_password: Boolean(row.should_reset_password),
        company: row.company ? String(row.company) : null,
        last_login: row.last_login as string | null,
        organization: {
          id: row.org_id ? String(row.org_id) : "",
          name: row.org_name ? String(row.org_name) : "",
          logo: row.org_logo ? String(row.org_logo) : null,
        },
      })
    );
    return NextResponse.json({ success: true, data: mappedData });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching users",
      },
      { status: 500 }
    );
  }
}
