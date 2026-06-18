import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  submitImaginaContract,
  tenantFromHost,
} from "@/core/integrations/imagina-energia";

const SubmitSchema = z.object({
  tramite_id: z.string().min(1),
  contract_id: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const db = getTursoClient(request);
    const tenant = tenantFromHost(request.headers.get("host")) || "test";
    const result = await submitImaginaContract(
      { db, tenant },
      {
        tramiteId: parsed.data.tramite_id,
        contractId: parsed.data.contract_id,
      },
    );

    return NextResponse.json(result, { status: result.status || 200 });
  } catch (error) {
    console.error("Imagina contract submit error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al enviar el contrato a Imagina",
      },
      { status: 500 },
    );
  }
}
