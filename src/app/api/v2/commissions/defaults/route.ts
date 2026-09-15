import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import {
  getDefaultCommissions,
  replaceDefaultCommissions,
} from "@/core/libsql/commissions/companyCommissions";

const defaultCommissionSchema = z.object({
  comercializadora_id: z.string().min(1),
  commission_type: z.enum(["percent", "fixed"]),
  commission_value: z.number().min(0),
});

const putSchema = z.object({
  defaults: z.array(defaultCommissionSchema),
});

/**
 * Comisiones por defecto de la asesoría, comunes a todos los colaboradores.
 * Cualquier usuario autenticado puede leerlas (se usan para calcular su propia
 * comisión); solo dirección puede modificarlas.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    const defaults = await getDefaultCommissions(tursoClient);
    return NextResponse.json({ success: true, data: defaults });
  } catch (error) {
    console.error("Error fetching default commissions:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (authResult.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const parsed = putSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid parameters" },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    await replaceDefaultCommissions(tursoClient, parsed.data.defaults);
    const defaults = await getDefaultCommissions(tursoClient);
    return NextResponse.json({ success: true, data: defaults });
  } catch (error) {
    console.error("Error updating default commissions:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
