import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getImaginaIntegrationStatus } from "@/core/integrations/imagina-energia";

export async function GET(request: NextRequest) {
  try {
    const db = getTursoClient(request);
    const status = await getImaginaIntegrationStatus(db);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Imagina integration status error:", error);
    return NextResponse.json(
      { success: false, error: "Error al consultar la integración" },
      { status: 500 },
    );
  }
}
