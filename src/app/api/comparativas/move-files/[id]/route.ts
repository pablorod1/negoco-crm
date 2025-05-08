import { moveFolderFromComparativasToTramites } from "@/lib/firebase/data/moveFolder";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { organization_id, tramite_id } = await req.json();

    if (!organization_id || !id || !tramite_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    const { success: moveFilesSuccess, error: moveFileError } =
      await moveFolderFromComparativasToTramites(
        tursoClient,
        organization_id,
        id,
        tramite_id
      );

    if (!moveFilesSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: moveFileError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error moving folder from comparativas to tramites:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error moving folder from comparativas to tramites",
      },
      { status: 500 }
    );
  }
}
