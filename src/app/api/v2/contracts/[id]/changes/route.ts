import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getTramiteChanges } from "@/tramites/utils/tramiteChangesHelpers";
import { TramiteChangeWithUser } from "@/tramites/types/tramite-changes.types";
import { Client } from "@libsql/client";

/**
 * CONTRACT CHANGES HISTORY ENDPOINT
 *
 * GET /api/v2/contracts/[id]/changes
 *
 * Retrieves the complete change history for a specific tramite/contract
 */

// ==================== TYPE DEFINITIONS ====================

interface ContractChangesResponse {
  success: boolean;
  data?: TramiteChangeWithUser[];
  error?: string;
}

// ==================== VALIDATION SCHEMAS ====================

const ContractChangesRequestSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "User role is required"),
  limit: z.number().min(1).max(1000).optional(),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Checks if user has permission to view contract changes
 */
async function checkViewPermission(
  tramiteId: string,
  userId: string,
  userRole: string,
  db: Client
): Promise<boolean> {
  try {
    // Admin and level 1 users can view all changes
    if (userRole === "admin" || userRole === "1") {
      return true;
    }

    // Commercial users can only view changes for their assigned tramites
    if (userRole === "2") {
      const result = await db.execute({
        sql: `SELECT user_id FROM tramites WHERE id = ? LIMIT 1`,
        args: [tramiteId],
      });

      if (result.rows.length === 0) {
        return false;
      }

      const tramiteUserId = result.rows[0].user_id;

      // Check if it's assigned to them or they're a super commercial
      const userResult = await db.execute({
        sql: `SELECT super_id FROM user WHERE id = ? LIMIT 1`,
        args: [userId],
      });

      if (userResult.rows.length === 0) {
        return false;
      }

      const superUser = userResult.rows[0].super_id;

      // Allow if it's their tramite or if they're checking their sub-commercial's tramite
      return tramiteUserId === userId || tramiteUserId === superUser;
    }

    return false;
  } catch (error) {
    console.error("Error checking view permission:", error);
    return false;
  }
}

// ==================== MAIN ENDPOINT ====================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ContractChangesResponse>> {
  try {
    const { id: tramiteId } = await params;

    // Parse request body
    const body = await request.json();
    const validationResult = ContractChangesRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request parameters",
        },
        { status: 400 }
      );
    }

    const { user_id, role, limit } = validationResult.data;

    // Get database client
    const db = getTursoClient(request);

    // Check permissions
    const hasPermission = await checkViewPermission(
      tramiteId,
      user_id,
      role,
      db
    );
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied",
        },
        { status: 403 }
      );
    }

    // Get change history
    const changes = await getTramiteChanges(db, tramiteId, limit);

    return NextResponse.json({
      success: true,
      data: changes as TramiteChangeWithUser[],
    });
  } catch (error) {
    console.error("Error fetching contract changes:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ContractChangesResponse>> {
  // Use GET method for this endpoint
  return GET(request, { params });
}
