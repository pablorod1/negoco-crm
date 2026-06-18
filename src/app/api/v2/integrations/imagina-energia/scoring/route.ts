import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import {
  ImaginaScoringRequestSchema,
  requestImaginaScoring,
  tenantFromHost,
} from "@/core/integrations/imagina-energia";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ImaginaScoringRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid scoring request",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const db = getTursoClient(request);
    const tenant = tenantFromHost(request.headers.get("host")) || "test";
    const result = await requestImaginaScoring({ db, tenant }, parsed.data);

    return NextResponse.json(result, { status: result.status || 200 });
  } catch (error) {
    console.error("Imagina scoring error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al solicitar scoring de Imagina",
      },
      { status: 500 },
    );
  }
}
