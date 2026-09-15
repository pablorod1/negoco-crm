import { NextRequest, NextResponse } from "next/server";
import type { Client } from "@libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { salesVisibleHistory } from "@/comparativas/server/history-privacy";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import {
  getComparativaChanges,
  ComparativaChange,
} from "@/comparativas/utils/comparativaChangesHelpers";

type QueryClient = Pick<Client, "execute">;

/**
 * Comprueba que el usuario autenticado puede ver la comparativa antes de
 * exponer su historial de cambios (los comerciales solo ven las suyas y las
 * de sus subcomerciales).
 */
async function canAccessComparison(
  client: QueryClient,
  comparisonId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  let sql = "SELECT 1 FROM comparativas WHERE id = ?";
  const args: string[] = [comparisonId];

  if (userRole === "2") {
    const subcomerciales = await getSubcomerciales(client, userId);
    const allowedUserIds = [userId];

    if (subcomerciales.success && subcomerciales.ids.length > 0) {
      allowedUserIds.push(...subcomerciales.ids);
    }

    sql += ` AND user_id IN (${allowedUserIds.map(() => "?").join(", ")})`;
    args.push(...allowedUserIds);
  } else if (userRole !== "admin" && userRole !== "1") {
    return false;
  }

  const result = await client.execute({ sql, args });

  return result.rows.length > 0;
}

/**
 * Response interface for comparison changes endpoint
 */
interface ComparisonChangesResponse {
  success: boolean;
  data?: ComparativaChange[];
  error?: string;
}

/**
 * GET /api/v2/comparisons/[id]/changes
 *
 * Retrieves the complete change history for a specific comparison
 *
 * @param req - Next.js request object
 * @param params - URL parameters containing comparison ID
 * @returns Promise<NextResponse<ComparisonChangesResponse>>
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ComparisonChangesResponse>> {
  try {
    const authResult = await validateUserSession(req);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    const authenticatedUser = authResult.user;
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "ID de comparativa requerido",
        },
        { status: 400 }
      );
    }

    // Initialize database client
    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      console.error("[Database Error] Failed to initialize Turso client");
      return NextResponse.json(
        {
          success: false,
          error: "Error de conexión a la base de datos",
        },
        { status: 500 }
      );
    }

    const hasAccess = await canAccessComparison(
      tursoClient,
      id,
      authenticatedUser.id,
      authenticatedUser.role
    );

    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Comparativa no encontrada",
        },
        { status: 404 }
      );
    }

    // Get comparison changes
    const changes = await getComparativaChanges(tursoClient, id);

    return NextResponse.json({
      success: true,
      data: authenticatedUser.role === "2" ? salesVisibleHistory(changes) : changes,
    });
  } catch (error) {
    console.error("[API Error] Failed to fetch comparison changes:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
