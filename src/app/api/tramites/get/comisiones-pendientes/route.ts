import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { id, role }: { id: string; role: string } = await req.json();

    if (!id || !role) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    let query = `
      SELECT SUM(CASE WHEN liquidez_status IN (${
        role === "2"
          ? "'Pendiente de Cobro', 'Cobrado por Comercializadora'"
          : "'Pendiente de Cobro'"
      }) THEN 1 ELSE 0 END) AS total
      FROM tramites`;

    const params: (string | number)[] = [];

    if (role === "2") {
      const subcomercialesRes = await fetch(
        `${req.nextUrl.origin}/api/users/get/subcomerciales`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id }),
        }
      );
      const subcomerciales = await subcomercialesRes.json();
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` WHERE user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")})`;
        params.push(id, ...subcomerciales.ids);
      } else {
        query += ` WHERE user_id = ?`;
        params.push(id);
      }
    }

    const rs = await tursoClient.execute({ sql: query, args: params });

    return NextResponse.json({
      success: true,
      data: rs.rows[0].total as number,
    });
  } catch (error) {
    console.error("Error al obtener las comisiones pendientes:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error desconocido",
      },
      { status: 500 }
    );
  }
}
