import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user_id, user_role } = await req.json();

    if (!user_id || !user_role) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 }
      );
    }

    let query = `
      SELECT 
        clients.*, 
        COUNT(DISTINCT tramites.id) AS tramites_count,
        COUNT(DISTINCT tramite_files.id) AS files_count 
      FROM clients
      LEFT JOIN tramites ON clients.id = tramites.client_id
      LEFT JOIN tramite_files ON tramites.id = tramite_files.tramite_id
      WHERE clients.id = ?
      `;
    const queryParams: string[] = [id];

    if (user_role === "2") {
      // Añadimos WHERE para filtrar por usuario o subcomerciales
      query += ` AND (`;

      const subcomercialesRes = await getSubcomerciales(tursoClient, user_id);

      if (
        subcomercialesRes.success &&
        subcomercialesRes.ids &&
        subcomercialesRes.ids.length > 0
      ) {
        // Si hay subcomerciales, buscamos trámites del usuario o de cualquiera de sus subcomerciales
        query += ` tramites.user_id = ? OR tramites.user_id IN (${subcomercialesRes.ids.map(() => "?").join(",")}))`;
        queryParams.push(user_id, ...subcomercialesRes.ids);
      } else {
        // Si no hay subcomerciales o falló la consulta, solo buscamos los trámites del usuario
        query += ` tramites.user_id = ?)`;
        queryParams.push(user_id);
      }
    }

    // Agrupamos por cliente para obtener los conteos correctos
    query += ` GROUP BY clients.id`;

    const res = await tursoClient.execute({ sql: query, args: queryParams });

    if (res.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cliente no encontrado o no tienes permisos para ver este cliente.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...res.rows[0],
          coordinates: JSON.parse(res.rows[0].coordinates as string),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
