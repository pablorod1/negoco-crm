import { ComparativaPlan } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      page,
      rowsPerPage,
      user_id,
      user_role,
      filterValue,
      statusFilter,
    }: {
      page: number;
      rowsPerPage: number;
      user_id: string;
      user_role: string;
      filterValue?: string;
      statusFilter?: string[];
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
              CASE 
                WHEN c.plan LIKE '%,%' THEN json_array('fijo', 'indexado')
                ELSE c.plan  -- Devolver el valor directamente, no como array
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
      const subcomercialesRes = await fetch(
        `${req.nextUrl.origin}/api/users/get/subcomerciales`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: user_id }),
        }
      );
      const subcomerciales = await subcomercialesRes.json();
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

    addArrayFilter("c.status", statusFilter);

    if (filters.length > 0) {
      query += ` WHERE ` + filters.join(" AND ");
    }

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
          user: {
            name: row.user_name as string,
            surname: row.user_surname as string,
            email: row.user_email as string,
            image: row.user_image as string,
          },
        };
      }),
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
