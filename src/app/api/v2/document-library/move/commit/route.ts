import { NextRequest, NextResponse } from "next/server";

import { getTursoClient } from "@/core/libsql/client";
import { getActiveSupplierNames } from "@/core/libsql/comercializadoras/getActiveSupplierNames";
import { commitDocumentLibraryMove } from "@/documentacion/lib/server/document-library-move";
import { MoveCommitBodySchema } from "../schemas";

interface MoveCommitResponse {
  success: boolean;
  moved?: number;
  error?: string;
  conflicts?: string[];
}

/**
 * Step 3 of a move: once the browser has copied every object to its planned
 * destination, rewrites the database rows in a single transaction. The plan
 * is recomputed server-side and each new download URL must point exactly to
 * the planned destination path.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<MoveCommitResponse>> {
  try {
    const validation = MoveCommitBodySchema.safeParse(await request.json());
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

    const { organization_id, request: moveRequest, updates } = validation.data;
    const outcome = await commitDocumentLibraryMove(
      tursoClient,
      moveRequest,
      updates,
      {
        organizationId: organization_id,
        activeSupplierNames: await getActiveSupplierNames(tursoClient),
      }
    );

    if (!outcome.success) {
      return NextResponse.json(
        { success: false, error: outcome.error, conflicts: outcome.conflicts },
        { status: outcome.status ?? 500 }
      );
    }

    return NextResponse.json({ success: true, moved: outcome.moved });
  } catch (error) {
    console.error("[DOCUMENT-LIBRARY-MOVE-COMMIT] Error:", error);
    return NextResponse.json(
      { success: false, error: "Error confirmando el movimiento en el servidor" },
      { status: 500 }
    );
  }
}
