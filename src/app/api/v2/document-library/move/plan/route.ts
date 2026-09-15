import { NextRequest, NextResponse } from "next/server";

import { getTursoClient } from "@/core/libsql/client";
import { getActiveSupplierNames } from "@/core/libsql/comercializadoras/getActiveSupplierNames";
import { planDocumentLibraryMove } from "@/documentacion/lib/server/document-library-move";
import type { MovePlan } from "@/documentacion/lib/move-types";
import { MovePlanBodySchema } from "../schemas";

interface MovePlanResponse {
  success: boolean;
  plan?: MovePlan;
  error?: string;
  conflicts?: string[];
}

/**
 * Step 1 of a move: validates the request (protected supplier folders, name
 * conflicts, self-nesting) and returns which storage object goes where. The
 * browser copies the objects itself and then calls /move/commit.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<MovePlanResponse>> {
  try {
    const validation = MovePlanBodySchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const { organization_id, request: moveRequest } = validation.data;
    const outcome = await planDocumentLibraryMove(tursoClient, moveRequest, {
      organizationId: organization_id,
      activeSupplierNames: await getActiveSupplierNames(tursoClient),
      checkStorage: true,
    });

    if (!outcome.success) {
      return NextResponse.json(
        { success: false, error: outcome.error, conflicts: outcome.conflicts },
        { status: outcome.status }
      );
    }

    return NextResponse.json({ success: true, plan: outcome.plan });
  } catch (error) {
    console.error("[DOCUMENT-LIBRARY-MOVE-PLAN] Error:", error);
    return NextResponse.json(
      { success: false, error: "Error preparando el movimiento en el servidor" },
      { status: 500 }
    );
  }
}
