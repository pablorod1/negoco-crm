import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { id, role } = await req.json();

    if (!id || !role) {
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

    let query = `SELECT DISTINCT clients.* FROM clients`;
    const params: string[] = [];

    if (role === "2") {
      // Primero añadimos el JOIN que es obligatorio en ambos casos
      query += ` JOIN tramites ON clients.id = tramites.client_id WHERE`;

      const subcomercialesRes = await getSubcomerciales(tursoClient, id);

      if (
        subcomercialesRes.success &&
        subcomercialesRes.ids &&
        subcomercialesRes.ids.length > 0
      ) {
        // Si hay subcomerciales, buscamos trámites del usuario o de cualquiera de sus subcomerciales
        query += ` tramites.user_id = ? OR tramites.user_id IN (${subcomercialesRes.ids.map(() => "?").join(",")})`;
        params.push(id, ...subcomercialesRes.ids);
      } else {
        // Si no hay subcomerciales o falló la consulta, solo buscamos los trámites del usuario
        query += ` tramites.user_id = ?`;
        params.push(id);
      }
    }

    const res = await tursoClient.execute({ sql: query, args: params });

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No clients found" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, data: res.rows },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
