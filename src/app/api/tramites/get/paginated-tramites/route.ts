import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { DateRange } from "react-day-picker";

export async function POST(req: NextRequest) {
  try {
    const {
      page,
      rowsPerPage,
      user_id,
      user_role,
      filterValue,
      companyFilter,
      statusFilter,
      liquidezStatusFilter,
      contractTypeFilter,
      dateRange,
    }: {
      page: number;
      rowsPerPage: number;
      user_id: string;
      user_role: string;
      filterValue?: string;
      companyFilter?: string[];
      statusFilter?: string[];
      liquidezStatusFilter?: string[];
      contractTypeFilter?: string[];
      dateRange?: DateRange | undefined;
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
    let query = `
          SELECT 
              t.id AS id,
              t.creation_date AS creation_date,
              t.renovation_date AS renovation_date,
              t.sales_name AS sales_name,
              t.comision_sales_person AS comision_sales_person,
              t.comision AS comision,
              t.status AS status,
              t.liquidez_status AS liquidez_status,
              c.name AS client_name,
              c.last_name AS client_last_name,
              c.email AS client_email,
              c.id AS client_id,
              COALESCE(GROUP_CONCAT(DISTINCT con.CUPS), '') AS CUPS,
              COALESCE(GROUP_CONCAT(DISTINCT con.new_company), '') AS new_companies,
              COALESCE(GROUP_CONCAT(DISTINCT con.old_company), '') AS old_companies,
              COALESCE(GROUP_CONCAT(DISTINCT con.plan), '') AS plans,
              COALESCE(GROUP_CONCAT(DISTINCT con.type), '') AS contract_types,
              COALESCE(GROUP_CONCAT(DISTINCT con.consumption), '') AS consumptions
          FROM 
              tramites t
          LEFT JOIN 
              clients c ON t.client_id = c.id
          LEFT JOIN 
              contracts con ON t.id = con.tramite_id
        `;

    const filters: string[] = [];
    const params: (string | number)[] = [];

    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids) {
        filters.push(
          `( t.user_id = ? OR (t.status != 'Borrador' AND t.user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")})))`
        );
        params.push(user_id, ...subcomerciales.ids);
      } else {
        filters.push(`t.user_id = ?`);
        params.push(user_id);
      }
    }

    // Dynamic filter generation
    const addTextFilter = (fields: string[], value: string) => {
      const likeConditions = fields
        .map((field) => `${field} LIKE ?`)
        .join(" OR ");
      filters.push(`(${likeConditions})`);
      fields.forEach(() => params.push(`%${value}%`));
    };

    if (filterValue) {
      addTextFilter(
        [
          "c.name",
          "c.last_name",
          `c.name || ' ' || c.last_name`,
          "c.email",
          "t.sales_name",
          "t.id",
          "con.CUPS",
        ],
        filterValue
      );
    }

    // Add array-based filters with null check
    const addArrayFilter = (column: string, filterArray?: string[]) => {
      if (filterArray && filterArray.length > 0) {
        filters.push(`${column} IN (${filterArray.map(() => "?").join(", ")})`);
        params.push(...filterArray);
      }
    };

    addArrayFilter("con.new_company", companyFilter);
    addArrayFilter("t.status", statusFilter);
    addArrayFilter("con.type", contractTypeFilter);
    addArrayFilter("t.liquidez_status", liquidezStatusFilter);

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

    // Group by main tramite fields
    query += ` GROUP BY 
          t.id, t.creation_date, t.renovation_date, t.sales_name, 
          t.comision_sales_person, t.comision, t.status, t.liquidez_status,
          c.name, c.last_name, c.email`;

    query += ` ORDER BY t.creation_date DESC`;

    // Add pagination
    query += ` LIMIT ? OFFSET ?;`;
    params.push(rowsPerPage, offset);

    const rs = await tursoClient.execute({
      sql: query,
      args: params,
    });

    return NextResponse.json({
      success: true,
      data: rs.rows.map((row) => {
        // Safe parsing with fallback to empty arrays
        const parseArray = (value: string | null) =>
          value ? value.split(",").filter(Boolean) : [];

        const parseNumericArray = (value: string | null) =>
          value
            ? value
                .split(",")
                .map((x) => {
                  const num = Number(x);
                  return !isNaN(num) ? num : null;
                })
                .filter((x) => x !== null)
            : [];

        return {
          id: row.id as string,
          creation_date: row.creation_date as string,
          renovation_date: row.renovation_date as string,
          sales_name: row.sales_name as string,
          client_name: `${row.client_name || ""} ${
            row.client_last_name || ""
          }`.trim(),
          client_email: row.client_email as string,
          client_id: row.client_id as string,
          CUPS: parseArray(row.CUPS as string),
          new_company: parseArray(row.new_companies as string),
          old_company: parseArray(row.old_companies as string),
          plan: parseArray(row.plans as string),
          contract_type: parseArray(row.contract_types as string),
          consumption: parseNumericArray(row.consumptions as string),
          comision_sales_person: row.comision_sales_person as number,
          comision: row.comision as number,
          status: row.status as string,
          liquidez_status: row.liquidez_status as string,
        };
      }),
      total,
    });
  } catch (error) {
    console.error("Error en el servidor obteniendo los trámites", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error en el servidor obteniendo los trámites",
      },
      { status: 500 }
    );
  }
}
