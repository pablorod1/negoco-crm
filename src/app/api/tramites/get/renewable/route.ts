import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { role, id } = await req.json();

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

    let query = `SELECT id, sales_name, renovation_date AS renovationDate FROM tramites WHERE status = 'Activo'`;
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
      data: rs.rows.map((row) => ({
        id: row.id as string,
        sales_name: row.sales_name as string,
        renovationDate: row.renovationDate as string,
      })),
    });
  } catch (error) {
    console.error("Error obteniendo trámites renovables", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error obteniendo trámites renovables",
      },
      { status: 500 }
    );
  }
}
