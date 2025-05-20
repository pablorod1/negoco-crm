import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { id, role }: { id: string; role: string } = await req.json();

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
          strftime('%Y-%m', activation_date) AS month_key,
          SUM(${role === "2" ? "comision_sales_person" : "comision"}) AS total
      FROM tramites
      WHERE strftime('%Y', activation_date) = strftime('%Y', 'now')`;

    const params: (string | number)[] = [];

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
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

    query += ` GROUP BY month_key ORDER BY month_key ASC`;

    const rs = await tursoClient.execute({ sql: query, args: params });

    // Mapeo de los nombres de los meses
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    // Crear un objeto con los datos obtenidos
    const comisionesMap = new Map<string, number>();
    rs.rows.forEach((row) => {
      const [, month] = String(row.month_key).split("-"); // Se obtiene el mes correctamente
      comisionesMap.set(month, row.total as number);
    });

    // Construir el array con todos los meses, rellenando los que no tienen datos con 0
    const result = monthNames.map((month, index) => {
      const monthKey = String(index + 1).padStart(2, "0"); // Formato "01", "02", etc.
      return {
        month,
        total: comisionesMap.get(monthKey) || 0, // Si no hay datos, se usa 0
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error obteniendo comisiones", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error obteniendo comisiones",
      },
      { status: 500 }
    );
  }
}
