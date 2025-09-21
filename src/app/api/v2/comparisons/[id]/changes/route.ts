import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import {
  getComparativaChanges,
  ComparativaChange,
} from "@/comparativas/utils/comparativaChangesHelpers";

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

    // Get comparison changes
    const changes = await getComparativaChanges(tursoClient, id);

    return NextResponse.json({
      success: true,
      data: changes,
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
