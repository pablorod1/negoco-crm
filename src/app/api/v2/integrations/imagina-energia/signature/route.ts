import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  getImaginaSignatureHealth,
  getImaginaSignatureStatus,
  ImaginaSignatureResendSchema,
  ImaginaSignatureSendSchema,
  resendImaginaSignature,
  sendImaginaSignature,
  tenantFromHost,
} from "@/core/integrations/imagina-energia";

const SignaturePostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send"),
    payload: ImaginaSignatureSendSchema,
  }),
  z.object({
    action: z.literal("resend"),
    payload: ImaginaSignatureResendSchema,
  }),
]);

export async function GET(request: NextRequest) {
  try {
    const db = getTursoClient(request);
    const tenant = tenantFromHost(request.headers.get("host")) || "test";
    const action = request.nextUrl.searchParams.get("action");

    if (action === "health") {
      const result = await getImaginaSignatureHealth({ db, tenant });
      return NextResponse.json(result, { status: result.status || 200 });
    }

    const circuitoId = request.nextUrl.searchParams.get("circuito_id");
    if (!circuitoId) {
      return NextResponse.json(
        { success: false, error: "Missing circuito_id" },
        { status: 400 },
      );
    }

    const result = await getImaginaSignatureStatus(
      { db, tenant },
      circuitoId,
      request.nextUrl.searchParams.get("referencia_externa") || undefined,
    );
    return NextResponse.json(result, { status: result.status || 200 });
  } catch (error) {
    console.error("Imagina signature GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al consultar firma de Imagina",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SignaturePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid signature request",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const db = getTursoClient(request);
    const tenant = tenantFromHost(request.headers.get("host")) || "test";
    const result =
      parsed.data.action === "send"
        ? await sendImaginaSignature({ db, tenant }, parsed.data.payload)
        : await resendImaginaSignature({ db, tenant }, parsed.data.payload);

    return NextResponse.json(result, { status: result.status || 200 });
  } catch (error) {
    console.error("Imagina signature POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al operar firma de Imagina",
      },
      { status: 500 },
    );
  }
}
