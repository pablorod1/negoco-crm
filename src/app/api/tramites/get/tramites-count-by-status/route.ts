import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { id, role } = await req.json();

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
      SELECT 
          status,
          COUNT(*) AS total
      FROM tramites 
    `;

    const params: (string | number)[] = [];

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` WHERE (user_id = ? OR (status != 'Borrador' AND user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")})))`;
        params.push(id, ...subcomerciales.ids);
      } else {
        query += ` WHERE user_id = ?`;
        params.push(id);
      }
    }

    query += ` GROUP BY status;`;

    const rs = await tursoClient.execute({ sql: query, args: params });

    return NextResponse.json({
      success: true,
      data: rs.rows.map((row) => ({
        status: row.status as string,
        total: row.total as number,
      })),
    });
  } catch (error) {
    console.error("Error fetching tramites:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching tramites",
      },
      { status: 500 }
    );
  }
}
