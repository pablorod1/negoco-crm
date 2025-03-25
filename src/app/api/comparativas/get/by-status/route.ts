import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { id, role, status } = await req.json();

    if (!id || !role || !status) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const queryParams: (string | number)[] = [status];

    let query = `
      SELECT 
        c.client, 
        c.creation_date,
        c.status,
        c.id,
        u.name as user_name,
        u.image as user_image
      FROM comparativas c
      LEFT JOIN user u ON c.user_id = u.id
      WHERE status = ?
    `;

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      const idsToInclude = [id];

      if (subcomerciales.success && subcomerciales.ids) {
        idsToInclude.push(...subcomerciales.ids);
      }

      query += ` AND ( user_id = ? OR user_id IN (${idsToInclude
        .map(() => "?")
        .join(", ")}))`;
      queryParams.push(id, ...idsToInclude);
    }

    const response = await tursoClient.execute({
      sql: query,
      args: queryParams,
    });

    return NextResponse.json({
      success: true,
      data: response.rows.map((r) => ({
        client: r.client,
        creation_date: r.creation_date,
        status: r.status,
        id: r.id,
        user: {
          name: r.user_name,
          image: r.user_image,
        },
      })),
    });
  } catch (error) {
    console.error("Error al obtener comparativas:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener comparativas" },
      { status: 500 }
    );
  }
}
