import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
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
    WITH months AS (
        SELECT '01' AS month, 'Enero' AS month_name UNION ALL
        SELECT '02', 'Febrero' UNION ALL
        SELECT '03', 'Marzo' UNION ALL
        SELECT '04', 'Abril' UNION ALL
        SELECT '05', 'Mayo' UNION ALL
        SELECT '06', 'Junio' UNION ALL
        SELECT '07', 'Julio' UNION ALL
        SELECT '08', 'Agosto' UNION ALL
        SELECT '09', 'Septiembre' UNION ALL
        SELECT '10', 'Octubre' UNION ALL
        SELECT '11', 'Noviembre' UNION ALL
        SELECT '12', 'Diciembre'
      )
      SELECT 
        m.month_name AS month,
        COALESCE(SUM(CASE WHEN t.status = 'Activo' THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN t.status = 'Baja' THEN 1 ELSE 0 END), 0) AS baja,
        ${role !== "2" ? "SUM(comision) AS comision," : ""}
        SUM(comision_sales_person) AS comision_sales_person
      FROM months m
      LEFT JOIN tramites t ON strftime('%m', t.activation_date) = m.month
        AND strftime('%Y', t.activation_date) = strftime('%Y', 'now')`;

    const queryParams: (string | number)[] = [];

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      query += ` AND`;
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        queryParams.push(id, ...subcomerciales.ids);
      } else {
        query += ` user_id = ?`;
        queryParams.push(id);
      }
    }

    query += ` GROUP BY m.month, m.month_name
      ORDER BY m.month;`;

    const rs = await tursoClient.execute({
      sql: query,
      args: queryParams,
    });

    return NextResponse.json({
      success: true,
      data: rs.rows.map((row) => ({
        month: row.month as string,
        active: row.active as number,
        baja: -(row.baja as number),
        comision: role !== "2" ? (row.comision as number) : 0,
        comision_sales_person: row.comision_sales_person as number,
      })),
    });
  } catch (error) {
    console.error("Error obteniendo trámites", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error obteniendo trámites",
      },
      { status: 500 }
    );
  }
}
