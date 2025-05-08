import { deleteFolderFromStorage } from "@/lib/firebase/data/deleteFolder";
import { getTursoClient } from "@/lib/libsql/client";
import { deleteComparativa } from "@/lib/libsql/comparativas/deleteComparativaHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { organization_id } = await req.json();

    if (!id || !organization_id) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const comparativaResponse = await deleteComparativa(tursoClient, id);

    if (!comparativaResponse.success) {
      return NextResponse.json(
        { error: comparativaResponse.error },
        { status: 500 }
      );
    }

    const filesResponse = await deleteFolderFromStorage(
      "comparativas",
      id,
      organization_id
    );

    if (!filesResponse.success) {
      return NextResponse.json(
        { error: filesResponse.errors },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
