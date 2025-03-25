import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { id, role, month } = await req.json();

    if (!id || !role || !month) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters. El mes (month) es obligatorio.",
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

    const params: (string | number)[] = [];

    let query = `
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS total,
      COALESCE(SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END), 0) AS processed

    FROM comparativas WHERE strftime('%m', creation_date) = strftime('%m', ?)
      AND strftime('%Y', creation_date) = strftime('%Y', 'now') AND status IN ('completed', 'processed')
    `;
    params.push(month);

    // Filtrar por rol si es necesario
    if (role === "2") {
      // Obtener subcomerciales para el comercial
      const subcomerciales = await getSubcomerciales(tursoClient, id);

      if (
        subcomerciales.success &&
        subcomerciales.ids &&
        subcomerciales.ids.length > 0
      ) {
        query += ` AND (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        params.push(id, ...subcomerciales.ids);
      } else {
        query += ` AND user_id = ?`;
        params.push(id);
      }
    }
    const rs = await tursoClient.execute({ sql: query, args: params });

    return NextResponse.json({
      success: true,
      data: rs.rows,
    });
  } catch (error) {
    console.error("Error fetching monthly comparativas data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching monthly comparativas data",
      },
      { status: 500 }
    );
  }
}
