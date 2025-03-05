import { TimeRange } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";
import { DateRange } from "react-day-picker";

export async function POST(req: NextRequest) {
  try {
    const {
      role,
      id,
      time_range,
      date_range,
    }: {
      role: string;
      id: string;
      time_range: TimeRange;
      date_range?: DateRange;
    } = await req.json();

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
          date(creation_date) as date,
          COUNT(*) as value
      FROM tramites
      WHERE status = 'Activo'`;

    const params: (string | number)[] = [];

    if (role === "2") {
      const subcomercialesRes = await fetch(
        `${req.nextUrl.origin}/api/users/get/subcomerciales?id=${id}`
      );
      const subcomerciales = await subcomercialesRes.json();
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` AND (user_id = ? OR user_id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`;
        params.push(id as string, ...subcomerciales.ids);
      } else {
        query += ` AND user_id = ?`;
        params.push(id as string);
      }
    }

    let groupBy = "";

    // Filtros de acuerdo al time_range
    if (time_range) {
      switch (time_range) {
        case "year":
          query += ` AND creation_date >= date('now', 'start of year')`;
          groupBy = `strftime('%m', creation_date)`;
          break;
        case "current_month":
          query += ` AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', 'now')`;
          groupBy = `strftime('%d', creation_date)`;
          break;
        case "current_week":
          query += ` AND strftime('%Y-%W', creation_date) = strftime('%Y-%W', 'now')`;
          groupBy = `strftime('%w', creation_date)`;
          break;
        case "last_week":
          query += ` AND strftime('%Y-%W', creation_date) = strftime('%Y-%W', 'now', '-7 days')`;
          groupBy = `strftime('%w', creation_date)`;
          break;
        case "90d":
          query += ` AND creation_date >= date('now', '-90 days')`;
          groupBy = `date(creation_date)`;
          break;
      }
    }

    if (date_range && date_range.from && date_range.to) {
      query += ` AND date(creation_date) BETWEEN date(?) AND date(?)`;
      groupBy = `date(creation_date)`;
    }

    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
    }
    query += ` ORDER BY date(creation_date)`;

    if (date_range && date_range.from && date_range.to) {
      params.push(date_range.from.toString(), date_range.to.toString());
    }

    const rs = await tursoClient.execute({ sql: query, args: params });
    const results = new Map<string, number>();

    // Procesar resultados según el time_range
    if (time_range === "current_week" || time_range === "last_week") {
      const weekStart =
        time_range === "current_week"
          ? new Date()
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Ajustar al lunes

      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const dayStr = day.toLocaleDateString("es-ES", { weekday: "long" });
        results.set(dayStr, 0);
      }

      rs.rows.forEach((row) => {
        const date = new Date(row.date as string);
        const dayStr = date.toLocaleDateString("es-ES", { weekday: "long" });
        results.set(dayStr, Number(row.value));
      });
    } else if (time_range === "current_month") {
      const daysInMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      ).getDate();

      for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = `${i}`;
        results.set(dayStr, 0);
      }

      rs.rows.forEach((row) => {
        const date = new Date(row.date as string);
        const dayStr = `${date.getDate()}`;
        results.set(dayStr, Number(row.value));
      });
    } else if (time_range === "year") {
      const months = [
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

      months.forEach((month) => results.set(month, 0));

      rs.rows.forEach((row) => {
        const date = new Date(row.date as string);
        const monthStr = months[date.getMonth()];
        results.set(monthStr, Number(row.value));
      });
    } else if (time_range === "90d") {
      const days = Array.from({ length: 90 }, (_, i) => i);

      days.forEach((day) => {
        const date = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
        const dayStr = date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
        });
        results.set(dayStr, 0);
      });

      rs.rows.forEach((row) => {
        const date = new Date(row.date as string);
        const dayStr = date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
        });
        results.set(dayStr, Number(row.value));
      });
    } else if (date_range && date_range.from && date_range.to) {
      const fromDate = new Date(date_range.from);
      const toDate = new Date(date_range.to);

      // Iteramos sobre cada día en el rango de fechas
      for (
        let date = new Date(fromDate);
        date <= toDate;
        date.setDate(date.getDate() + 1)
      ) {
        const dateStr = date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
        }); // Ejemplo: "martes 13"
        results.set(dateStr, 0);
      }

      // Poblar los valores obtenidos de la consulta
      rs.rows.forEach((row) => {
        const dateObj = new Date(row.date as string);
        const dateStr = dateObj.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
        });

        if (results.has(dateStr)) {
          results.set(dateStr, Number(row.value));
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: Array.from(results.entries()).map(([field, value]) => ({
        field,
        active: value,
      })),
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching trámites",
      },
      { status: 500 }
    );
  }
}
