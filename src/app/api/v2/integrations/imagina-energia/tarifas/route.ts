import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import {
  syncImaginaTarifas,
  tenantFromHost,
} from "@/core/integrations/imagina-energia";

export async function GET(request: NextRequest) {
  try {
    const db = getTursoClient(request);
    const tenant = tenantFromHost(request.headers.get("host")) || "test";
    const result = await syncImaginaTarifas({ db, tenant });

    return NextResponse.json(result, { status: result.status || 200 });
  } catch (error) {
    console.error("Imagina tarifas sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al sincronizar tarifas de Imagina",
      },
      { status: 500 },
    );
  }
}
