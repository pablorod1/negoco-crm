import { NextRequest, NextResponse } from "next/server";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";

/** Comprueba que el usuario puede usar el comparador propio en este tenant. */
export async function GET(request: NextRequest) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;

    return NextResponse.json(
      { success: true, data: { enabled: true } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[comparador] status check failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
