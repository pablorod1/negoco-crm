import { getTursoClient } from "@/lib/libsql/client";
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

    const queryParams: (string | number)[] = [status, id];

    let query = `
      SELECT 
        client, 
        creation_date,
        status,
        id
      FROM comparativas
      WHERE status = ? AND user_id = ?
    `;

    if (role === "2") {
      const subcomercialesRes = await fetch(
        `${req.nextUrl.origin}/api/users/get/subcomerciales?id=${id}`
      );

      const subcomerciales = await subcomercialesRes.json();
      const idsToInclude = [id];

      if (subcomerciales.success && subcomerciales.ids) {
        idsToInclude.push(...subcomerciales.ids);
      }

      query += ` AND user_id IN (${idsToInclude.map(() => "?").join(", ")})`;
      queryParams.push(...idsToInclude);
    }

    const response = await tursoClient.execute({
      sql: query,
      args: queryParams,
    });

    return NextResponse.json({ success: true, data: response.rows });
  } catch (error) {
    console.error("Error al obtener comparativas:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener comparativas" },
      { status: 500 }
    );
  }
}
