import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { z } from "zod";
import { getTenantFromHost } from "@/core/branding/tenant";
import { resolveBrandingFromOrganization } from "@/core/branding/metadata";
import type { ResolvedBranding } from "@/core/branding/types";
import { getEffectivePermissions } from "@/core/access-control/server";
import type { PermissionMap } from "@/core/access-control/types";
import { validateUserSession } from "@/core/auth/session-utils";

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
      abarca_user_id?: number;
      branding: ResolvedBranding;
    };
    company_commissions: {
      id: string;
      user_id: string;
      comercializadora_id: string;
      comercializadora_name: string | null;
      commission_type: "percent" | "fixed";
      commission_value: number;
      created_at: string | null;
      updated_at: string | null;
    }[];
    targeted_notes: {
      id: string;
      user_id: string;
      target: "global" | "tramites" | "comparativas";
      note: string;
      created_at: string | null;
      updated_at: string | null;
    }[];
    permissions: PermissionMap;
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
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<UserResponse | ErrorResponse>> {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;

    // Validate parameters
    const validation = GetUserParamsSchema.safeParse({ id });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Invalid parameters",
        },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 },
      );
    }

    // Optimized query with prepared statement - MAINTAINS ORIGINAL FUNCTIONALITY
    // First try to get the user with all JOINs
    const response = await tursoClient.execute({
      sql: `SELECT 
        u.*,
        o.id as org_id,
        o.name as org_name,
        o.logo as org_logo,
        o.metadata as org_metadata,
        o.plan as org_plan,
        o.abarca_user_id as org_abarca_user_id,
        LOWER(p.name) as plan_name,
        COUNT(n.id) as notifications
      FROM user u
      LEFT JOIN member m ON u.id = m.user_id
      LEFT JOIN organization o ON m.organization_id = o.id
      LEFT JOIN plans p ON o.plan = p.id
      LEFT JOIN notifications n ON u.id = n.user_id
      WHERE u.id = ?
      GROUP BY u.id, o.id, o.name, o.logo, o.metadata, o.plan, p.name`,
      args: [id],
    });

    if (response.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      );
    }

    const row = response.rows[0];
    const tenant = getTenantFromHost(request.headers.get("host"));
    const planName = row.plan_name ? String(row.plan_name) : null;
    const orgName = row.org_name ? String(row.org_name) : "";
    const orgLogo = row.org_logo ? String(row.org_logo) : null;
    const orgMetadata = row.org_metadata ? String(row.org_metadata) : null;
    const branding = resolveBrandingFromOrganization({
      tenant,
      name: orgName,
      logo: orgLogo,
      plan: planName,
      metadata: orgMetadata,
    });
    const userRole = String(row.role);
    const [commissionsResponse, notesResponse, permissions] = await Promise.all([
      tursoClient.execute({
        sql: `SELECT
          ucc.id,
          ucc.user_id,
          ucc.comercializadora_id,
          c.name as comercializadora_name,
          ucc.commission_type,
          ucc.commission_value,
          ucc.created_at,
          ucc.updated_at
        FROM user_company_commissions ucc
        LEFT JOIN comercializadoras c ON c.id = ucc.comercializadora_id
        WHERE ucc.user_id = ?
        ORDER BY c.name ASC`,
        args: [id],
      }),
      tursoClient.execute({
        sql: `SELECT id, user_id, target, note, created_at, updated_at
        FROM user_default_notes
        WHERE user_id = ?
        ORDER BY created_at ASC`,
        args: [id],
      }),
      getEffectivePermissions(tursoClient, { id, role: userRole }),
    ]);

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
        role: userRole,
        super_id: row.super_id ? String(row.super_id) : null,
        should_reset_password: Boolean(row.should_reset_password),
        notifications: Number(row.notifications) || 0,
        company: row.company ? String(row.company) : null,
        organization: {
          id: row.org_id ? String(row.org_id) : "",
          name: orgName,
          logo: orgLogo,
          plan: planName,
          abarca_user_id:
            row.org_abarca_user_id !== null &&
            row.org_abarca_user_id !== undefined
              ? Number(row.org_abarca_user_id)
              : undefined,
          branding,
        },
        company_commissions: commissionsResponse.rows.map((commission) => ({
          id: String(commission.id),
          user_id: String(commission.user_id),
          comercializadora_id: String(commission.comercializadora_id),
          comercializadora_name: commission.comercializadora_name
            ? String(commission.comercializadora_name)
            : null,
          commission_type: String(commission.commission_type) as
            | "percent"
            | "fixed",
          commission_value: Number(commission.commission_value) || 0,
          created_at: commission.created_at ? String(commission.created_at) : null,
          updated_at: commission.updated_at ? String(commission.updated_at) : null,
        })),
        targeted_notes: notesResponse.rows.map((note) => ({
          id: String(note.id),
          user_id: String(note.user_id),
          target: String(note.target) as "global" | "tramites" | "comparativas",
          note: String(note.note),
          created_at: note.created_at ? String(note.created_at) : null,
          updated_at: note.updated_at ? String(note.updated_at) : null,
        })),
        permissions,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 },
    );
  }
}

/**
 * Legacy POST endpoint for backward compatibility
 * Maintains identical functionality to the original /api/users/get/[id] route
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<UserResponse | ErrorResponse>> {
  // Delegate to GET method for backward compatibility
  return GET(request, { params });
}
