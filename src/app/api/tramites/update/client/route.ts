import { getTursoClient } from "@/lib/libsql/client";
import { updateClient } from "@/lib/libsql/tramites/updateTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { client } = await req.json();

    if (!client) {
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

    const updateResult = await updateClient(client, client.id, tursoClient);
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
        error: "Error actualizando cliente",
      },
      { status: 500 }
    );
  }
}
