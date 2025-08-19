import { getTursoClient } from "@/core/libsql/client";
import { updateSigner } from "@/tramites/utils/updateTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { signer } = await req.json();

    if (!signer) {
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

    const updateResult = await updateSigner(signer, signer.id, tursoClient);
    if (!updateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: updateResult.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: "Error actualizando firmante",
      },
      { status: 500 }
    );
  }
}
