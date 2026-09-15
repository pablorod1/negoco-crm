import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { getEffectiveCommissions } from "@/core/libsql/commissions/companyCommissions";

/**
 * Comisiones que se aplican realmente a un colaborador, ya resueltas: su
 * override si lo tiene, y si no, el valor por defecto de la asesoría.
 * A diferencia de /config, un comercial puede consultar las suyas (y las de su
 * equipo) porque las necesita para calcular la comisión de trámites y
 * comparativas.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const { id: requesterId, role } = authResult.user;

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    const isPrivileged = role === "admin" || role === "1";
    if (!isPrivileged && requesterId !== id) {
      const subcomerciales = await getSubcomerciales(tursoClient, requesterId);
      if (!subcomerciales.ids.includes(id)) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }
    }

    const commissions = await getEffectiveCommissions(tursoClient, id);
    return NextResponse.json({ success: true, data: commissions });
  } catch (error) {
    console.error("Error fetching effective commissions:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
