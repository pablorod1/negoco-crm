import { NextRequest, NextResponse } from "next/server";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { getAllCommissionOverrides } from "@/core/libsql/commissions/companyCommissions";

/**
 * Devuelve todos los overrides de comisión de la asesoría en una sola llamada.
 * La matriz de comisiones se pinta de un golpe; solo dirección puede verla.
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
    if (authResult.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    const overrides = await getAllCommissionOverrides(tursoClient);
    return NextResponse.json({ success: true, data: overrides });
  } catch (error) {
    console.error("Error fetching commission overrides:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
