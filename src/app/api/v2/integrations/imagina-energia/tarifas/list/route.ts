import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { IMAGINA_PROVIDER } from "@/core/integrations/imagina-energia";

export async function GET(request: NextRequest) {
  try {
    const db = getTursoClient(request);
    const result = await db.execute({
      sql: `SELECT id, name, type, price, comercializadora_id, provider,
                   external_rate_id, alias_externo, codigo_atr, descripcion,
                   raw, synced_at, enabled
            FROM comercializadora_rates
            WHERE provider = ?
              AND enabled = 1
              AND external_rate_id IS NOT NULL
            ORDER BY codigo_atr ASC, alias_externo ASC, name ASC`,
      args: [IMAGINA_PROVIDER],
    });

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Imagina tarifas list error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al listar tarifas sincronizadas de Imagina",
      },
      { status: 500 },
    );
  }
}
