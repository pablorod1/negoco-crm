import { getTursoClient } from "@/core/libsql/client";
import { updateContract } from "@/tramites/utils/updateTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { contract } = await req.json();
    if (!contract) {
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

    const updateResult = await updateContract(
      contract,
      contract.id,
      tursoClient
    );
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
        error: "Error actualizando tramite",
      },
      { status: 500 }
    );
  }
}
