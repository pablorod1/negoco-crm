import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import {
  getAndReconcileImaginaContract,
  syncImaginaContractsDump,
  tenantFromHost,
} from "@/core/integrations/imagina-energia";

export async function GET(request: NextRequest) {
  try {
    const db = getTursoClient(request);
    const tenant = tenantFromHost(request.headers.get("host")) || "test";
    const contractId = request.nextUrl.searchParams.get("contract_id");

    if (contractId) {
      const result = await getAndReconcileImaginaContract(
        { db, tenant },
        contractId,
      );
      return NextResponse.json(result, { status: result.status || 200 });
    }

    const perPage = Number(request.nextUrl.searchParams.get("per_page") || 500);
    const result = await syncImaginaContractsDump({ db, tenant }, { perPage });
    return NextResponse.json(result, { status: result.status || 200 });
  } catch (error) {
    console.error("Imagina contracts sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al sincronizar contratos de Imagina",
      },
      { status: 500 },
    );
  }
}
