import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { z } from "zod";

// Request Validation Schemas
const GetPlanInfoParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

// Response Types
interface PlanInfo {
  plan: {
    id: number;
    name: string;
    max_members: number | null;
  };
  current_members: number;
  can_add_members: boolean;
}

interface PlanInfoResponse {
  success: true;
  data: PlanInfo;
}

interface ErrorResponse {
  success: false;
  error: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<PlanInfoResponse | ErrorResponse>> {
  try {
    const { id } = await params;

    // Validate path param
    const paramsValidation = GetPlanInfoParamsSchema.safeParse({ id });
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

    // Get the user's organization and plan information
    const organizationQuery = `
      SELECT o.id as org_id, o.plan, p.id as plan_id, p.name as plan_name, p.max_members
      FROM user u
      INNER JOIN member m ON u.id = m.user_id
      INNER JOIN organization o ON m.organization_id = o.id
      INNER JOIN plans p ON o.plan = p.id
      WHERE u.id = ?
    `;

    const orgResponse = await tursoClient.execute({
      sql: organizationQuery,
      args: [id],
    });

    if (orgResponse.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User organization not found",
        },
        { status: 404 }
      );
    }

    const orgData = orgResponse.rows[0];
    const organizationId = String(orgData.org_id);
    const planId = Number(orgData.plan_id);
    const planName = String(orgData.plan_name);
    const maxMembers = orgData.max_members ? Number(orgData.max_members) : null;

    // Count current members in the organization
    const memberCountQuery = `
      SELECT COUNT(*) as member_count
      FROM member m
      INNER JOIN user u ON m.user_id = u.id
      WHERE m.organization_id = ?
    `;

    const countResponse = await tursoClient.execute({
      sql: memberCountQuery,
      args: [organizationId],
    });

    const currentMembers = Number(countResponse.rows[0].member_count);

    // Determine if more members can be added
    const canAddMembers = maxMembers === null || currentMembers < maxMembers;

    const planInfo: PlanInfo = {
      plan: {
        id: planId,
        name: planName,
        max_members: maxMembers,
      },
      current_members: currentMembers,
      can_add_members: canAddMembers,
    };

    return NextResponse.json({ success: true, data: planInfo });
  } catch (error) {
    console.error("Error fetching plan info:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching plan information",
      },
      { status: 500 }
    );
  }
}
