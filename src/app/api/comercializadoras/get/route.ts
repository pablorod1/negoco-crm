import { ComercializadoraVM } from "@/comercializadoras/types";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { Row } from "@libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { user_id, user_role } = await req.json();

    if (!user_id || !user_role) {
      return NextResponse.json(
        { success: false, error: "Missing Parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database not initialized" },
        { status: 500 }
      );
    }

    let query: string;
    const params: (string | number)[] = [];

    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      const subIds =
        subcomerciales.success && subcomerciales.ids ? subcomerciales.ids : [];

      query = `
        SELECT 
          c.id,
          c.name,
          c.logo,
          c.active,
          COUNT(DISTINCT df.id) AS files_count,
          COUNT(DISTINCT CASE 
            WHEN con.tramite_id IS NOT NULL AND (
              t.user_id = ? ${subIds.length > 0 ? `OR t.user_id IN (${subIds.map(() => "?").join(", ")})` : ""}
            ) THEN con.tramite_id 
          END) AS total_tramites
        FROM 
          comercializadoras c
        LEFT JOIN 
          contracts con ON con.new_company = c.name
        LEFT JOIN 
          tramites t ON t.id = con.tramite_id
        LEFT JOIN 
          documentacion_files df ON df.folder_name LIKE '%' || c.name || '%'
        GROUP BY 
          c.id, c.name, c.logo, c.active
        ORDER BY 
          c.name ASC
      `;

      params.push(user_id, ...subIds);
    } else {
      query = `
        SELECT 
          c.id,
          c.name,
          c.logo,
          c.active,
          COUNT(DISTINCT df.id) AS files_count,
          COUNT(DISTINCT CASE 
            WHEN con.tramite_id IS NOT NULL THEN con.tramite_id 
          END) AS total_tramites
        FROM 
          comercializadoras c
        LEFT JOIN 
          contracts con ON con.new_company = c.name
        LEFT JOIN 
          tramites t ON t.id = con.tramite_id
        LEFT JOIN 
          documentacion_files df ON df.folder_name LIKE '%' || c.name || '%'
        GROUP BY 
          c.id, c.name, c.logo, c.active
        ORDER BY 
          c.name ASC
      `;
    }

    const response = await tursoClient.execute(query, params);

    if (response.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No commercializadoras found" },
        { status: 404 }
      );
    }

    const comercializadoras: ComercializadoraVM[] = response.rows.map(
      (row: Row) => ({
        id: row.id as string,
        name: row.name as string,
        logo: row.logo as string,
        active: Boolean(row.active),
        num_tramites: Number(row.total_tramites) || 0,
        num_files: Number(row.files_count) || 0,
      })
    );

    return NextResponse.json(
      { success: true, data: comercializadoras },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al obtener comercializadoras: ", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
