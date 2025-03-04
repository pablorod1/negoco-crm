import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userData = JSON.parse(searchParams.get("userData") || "{}");
    const time_range = searchParams.get("time_range") || "year";

    if (!userData.id || !userData.role) {
      return NextResponse.json(
        {
          success: false,
          error: "Parámetros faltantes",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Cliente de base de datos no inicializado",
        },
        { status: 500 }
      );
    }

    let query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.image,
        u.role,
        u.super_id,
        COUNT(CASE WHEN t.status = 'Activo' THEN 1 END) as active
      FROM user u
      LEFT JOIN tramites t ON u.id = t.user_id
    `;
    const params: (string | number)[] = [];

    if (userData.role === "2") {
      // Para comerciales, obtener stats de sus subcomerciales
      query += ` WHERE u.super_id = ?`;
      params.push(userData.id);
    } else {
      // Para otros roles, obtener stats de todos los usuarios excepto él mismo
      query += ` WHERE u.id != ?`;
      params.push(userData.id);
    }

    if (time_range === "current_month") {
      query += ` AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', 'now')`;
    } else if (time_range === "current_week") {
      query += ` AND strftime('%Y-%W', t.creation_date) = strftime('%Y-%W', 'now')`;
    } else if (time_range === "last_week") {
      query += ` AND strftime('%Y-%W', t.creation_date) = strftime('%Y-%W', 'now', '-7 days')`;
    } else if (time_range === "90d") {
      query += ` AND t.creation_date >= date('now', '-90 days')`;
    } else if (time_range === "year") {
      query += ` AND strftime('%Y', t.creation_date) = strftime('%Y', 'now')`;
    }

    query += ` GROUP BY u.id, u.name, u.email, u.role, u.super_id, u.image;`;

    const rs = await tursoClient.execute({ sql: query, args: params });

    return NextResponse.json({
      success: true,
      data: rs.rows.map((row) => ({
        user: {
          id: row.id as string,
          name: row.name as string,
          email: row.email as string,
          image: row.image as string,
          role: row.role as string,
          super_id: row.super_id as string,
        },
        active: (row.active as number) || 0,
      })),
    });
  } catch (error) {
    console.error("Error obteniendo trámites del equipo", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error desconocido obteniendo trámites del equipo",
      },
      { status: 500 }
    );
  }
}
