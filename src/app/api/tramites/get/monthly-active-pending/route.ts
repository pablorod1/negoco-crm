import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
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

    const rs = await tursoClient.execute(`
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
        SUM(comision) AS comision,
        SUM(comision_sales_person) AS comision_sales_person
      FROM months m
      LEFT JOIN tramites t ON strftime('%m', t.creation_date) = m.month
        AND strftime('%Y', t.creation_date) = strftime('%Y', 'now') -- Filtra solo el año actual
      GROUP BY m.month, m.month_name
      ORDER BY m.month;
    `);

    return NextResponse.json({
      success: true,
      data: rs.rows.map((row) => ({
        month: row.month as string,
        active: row.active as number,
        baja: -(row.baja as number),
        comision: row.comision as number,
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
