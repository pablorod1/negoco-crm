import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getAuth } from "@/core/auth/auth";
import { z } from "zod";

// Request Validation Schemas
const OrganizationMembershipParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

const AddMemberBodySchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  role: z.string().min(1, "Role is required"), // Changed to accept any string for BetterAuth compatibility
});

const UpdateCompanyBodySchema = z.object({
  company: z.string().min(1, "Company name is required"),
});

const UpdateSuperBodySchema = z.object({
  super_id: z.string().min(1, "Super ID is required"),
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
 * Adds user to organization (creates organization membership)
 * @param request - Next.js request object with organizationId and role
 * @param params - Route parameters containing user ID
 * @returns Promise<NextResponse<SuccessResponse | ErrorResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id: userId } = await params;

    // Validate parameters
    const paramsValidation = OrganizationMembershipParamsSchema.safeParse({
      id: userId,
    });
    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            paramsValidation.error.errors[0]?.message || "Invalid parameters",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const bodyValidation = AddMemberBodySchema.safeParse(body);
    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            bodyValidation.error.errors[0]?.message || "Invalid request body",
        },
        { status: 400 }
      );
    }

    const { organizationId, role } = bodyValidation.data;

    const auth = getAuth(request);

    // Map role to BetterAuth expected values
    const mappedRole: "member" | "admin" | "owner" =
      role === "admin" ? "admin" : "member";

    // Call BetterAuth API to add member to organization
    const result = await auth.api.addMember({
      body: {
        userId,
        organizationId,
        role: mappedRole,
      },
    });

    if (result) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to add member to organization",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error adding user to organization:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error adding user to organization",
      },
      { status: 500 }
    );
  }
}

/**
 * Updates organization membership details
 * This method handles both company updates and super role assignments
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
    const paramsValidation = OrganizationMembershipParamsSchema.safeParse({
      id,
    });
    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            paramsValidation.error.errors[0]?.message || "Invalid parameters",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Determine which update operation based on request body
    const isCompanyUpdate = "company" in body;
    const isSuperUpdate = "super_id" in body;

    if (!isCompanyUpdate && !isSuperUpdate) {
      return NextResponse.json(
        {
          success: false,
          error: "Request must contain either 'company' or 'super_id' field",
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

    let response;

    if (isCompanyUpdate) {
      // Handle company update
      const companyValidation = UpdateCompanyBodySchema.safeParse(body);
      if (!companyValidation.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              companyValidation.error.errors[0]?.message ||
              "Invalid company data",
          },
          { status: 400 }
        );
      }

      const { company } = companyValidation.data;

      response = await tursoClient.execute({
        sql: `UPDATE user SET company = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [company, id],
      });
    } else if (isSuperUpdate) {
      // Handle super role assignment
      const superValidation = UpdateSuperBodySchema.safeParse(body);
      if (!superValidation.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              superValidation.error.errors[0]?.message ||
              "Invalid super role data",
          },
          { status: 400 }
        );
      }

      const { super_id } = superValidation.data;

      response = await tursoClient.execute({
        sql: `UPDATE user SET super_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [super_id, id],
      });
    }

    if (!response || response.rowsAffected === 0) {
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
    console.error("Error updating organization membership:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error updating organization membership",
      },
      { status: 500 }
    );
  }
}
