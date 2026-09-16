import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import {
  getImaginaContractReadiness,
  tenantFromHost,
} from "@/core/integrations/imagina-energia";

// Qué datos faltan para poder enviar el contrato a Imagina (barra de progreso).
export async function GET(request: NextRequest) {
  try {
    const tramiteId = request.nextUrl.searchParams.get("tramite_id");
    if (!tramiteId) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 },
      );
    }

    const db = getTursoClient(request);
    const tenant = tenantFromHost(request.headers.get("host")) || "test";
    const result = await getImaginaContractReadiness(
      { db, tenant },
      {
        tramiteId,
        contractId: request.nextUrl.searchParams.get("contract_id"),
      },
    );

    return NextResponse.json(result, { status: result.status || 200 });
  } catch (error) {
    console.error("Imagina contract readiness error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al comprobar los datos para Imagina",
      },
      { status: 500 },
    );
  }
}
