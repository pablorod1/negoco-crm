import { ComparativaPlan } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { NextRequest, NextResponse } from "next/server";
import { DateRange } from "react-day-picker";

export async function POST(req: NextRequest) {
  try {
    const {
      page,
      rowsPerPage,
      user_id,
      user_role,
      filterValue,
      statusFilter,
      dateRange,
    }: {
      page: number;
      rowsPerPage: number;
      user_id: string;
      user_role: string;
      filterValue?: string;
      statusFilter?: string[];
      dateRange: DateRange | undefined;
    } = await req.json();

    if (!page || !rowsPerPage || !user_id || !user_role) {
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

    const offset = (page - 1) * rowsPerPage;
    let query = `SELECT 
                  c.id AS id,
                  c.creation_date AS creation_date,
                  c.client AS client,
                  c.comision_sales_person_fijo AS comision_sales_person_fijo,
                  c.comision_sales_person_indexado AS comision_sales_person_indexado,
                  c.comision_fijo AS comision_fijo,
                  c.comision_indexado AS comision_indexado,
                  c.status AS status,
                  c.service AS service,
                  c.tramite_id AS tramite_id,
                  CASE 
        WHEN JSON_VALID(c.plan) THEN c.plan  -- Si el valor ya es un JSON válido, lo usamos tal cual
        ELSE JSON_ARRAY(c.plan)  -- Si no es un JSON válido, lo convertimos en un array con el valor
    END AS plan,
                  u.name AS user_name,
                  u.email AS user_email,
                  u.image AS user_image
              FROM comparativas c
              JOIN user u ON c.user_id = u.id
          `;

    const filters: string[] = [];
    const params: (string | number)[] = [];

    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids) {
        filters.push(
          `( c.user_id = ? OR c.user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")}))`
        );
        params.push(user_id, ...subcomerciales.ids);
      } else {
        filters.push(`c.user_id = ?`);
        params.push(user_id);
      }
    }

    const addTextFilter = (fields: string[], value: string) => {
      const likeConditions = fields
        .map((field) => `${field} LIKE ?`)
        .join(" OR ");
      filters.push(`(${likeConditions})`);
      fields.forEach(() => params.push(`%${value}%`));
    };

    if (filterValue) {
      addTextFilter(["c.client", "c.id", "u.email", "u.name"], filterValue);
    }

    const addArrayFilter = (column: string, filterArray?: string[]) => {
      if (filterArray && filterArray.length > 0) {
        filters.push(`${column} IN (${filterArray.map(() => "?").join(", ")})`);
        params.push(...filterArray);
      }
    };

    if (dateRange && dateRange.from && dateRange.to) {
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);

      // Ajusta para obtener el día correcto
      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(creation_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    addArrayFilter("c.status", statusFilter);

    let countQuery = `
      SELECT COUNT(*) AS total
      FROM comparativas c
      JOIN user u ON c.user_id = u.id
    `;

    if (filters.length > 0) {
      query += ` WHERE ` + filters.join(" AND ");
      countQuery += ` WHERE ` + filters.join(" AND ");
    }

    const countResult = await tursoClient.execute({
      sql: countQuery,
      args: params,
    });
    const total = countResult.rows[0]?.total || 0;

    query += ` GROUP BY c.id, c.creation_date, c.client, c.comision_sales_person_fijo, c.comision_sales_person_indexado, c.comision_fijo, c.comision_indexado, c.status, c.service, c.plan, u.name, u.email, u.image`;

    query += ` ORDER BY c.creation_date DESC`;

    query += ` LIMIT ? OFFSET ?`;
    params.push(rowsPerPage, offset);

    const rs = await tursoClient.execute({
      sql: query,
      args: params,
    });

    return NextResponse.json({
      success: true,
      data: rs.rows.map((row) => {
        return {
          id: row.id as string,
          creation_date: row.creation_date as string,
          client: row.client as string,
          comision_sales_person: {
            fijo: row.comision_sales_person_fijo as number,
            indexado: row.comision_sales_person_indexado as number,
          },
          comision: {
            fijo: row.comision_fijo as number,
            indexado: row.comision_indexado as number,
          },
          status: row.status as string,
          service: row.service as "Luz" | "Gas",
          plan: JSON.parse(row.plan as string) as ComparativaPlan[],
          tramite_id: row.tramite_id as string,
          user: {
            name: row.user_name as string,
            email: row.user_email as string,
            image: row.user_image as string,
          },
        };
      }),
      total,
    });
  } catch (error) {
    console.error("Error al obtener comparativas:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
