import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
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
      activationDateRange,
      creationDateRange,
      userFilter,
      typeFilter,
    }: {
      page: number;
      rowsPerPage: number | string;
      user_id: string;
      user_role: string;
      filterValue?: string;
      statusFilter?: string[];
      activationDateRange?: DateRange | undefined;
      creationDateRange?: DateRange | undefined;
      userFilter?: string[];
      typeFilter?: string[];
    } = await req.json();

    // Validate required parameters
    if (!page || !rowsPerPage || !user_id || !user_role) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const offset =
      rowsPerPage === "Sin Límite"
        ? 0
        : typeof rowsPerPage === "number"
          ? (page - 1) * rowsPerPage
          : 0;
    const filters: string[] = [];
    const params: (string | number)[] = [];

    // User role-based filtering
    if (user_role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, user_id);
      if (subcomerciales.success && subcomerciales.ids) {
        filters.push(
          `(f.user_id = ? OR f.user_id IN (${subcomerciales.ids
            .map(() => "?")
            .join(", ")}))`
        );
        params.push(user_id, ...subcomerciales.ids);
      } else {
        filters.push(`f.user_id = ?`);
        params.push(user_id);
      }
    } else {
      // For other roles: apply userFilter if provided, otherwise show all non-draft tramites
      if (userFilter && userFilter.length > 0) {
        filters.push(
          `(f.user_id IN (${userFilter.map(() => "?").join(", ")}))`
        );
        params.push(...userFilter, user_id);
      }
    }

    // Dynamic text filter
    const addTextFilter = (fields: string[], value: string) => {
      const likeConditions = fields
        .map((field) => `${field} LIKE ?`)
        .join(" OR ");
      filters.push(`(${likeConditions})`);
      fields.forEach(() => params.push(`%${value}%`));
    };

    if (filterValue) {
      addTextFilter(["f.id", "f.client"], filterValue);
    }

    // Array-based filters
    const addArrayFilter = (column: string, filterArray?: string[]) => {
      if (filterArray && filterArray.length > 0) {
        filters.push(`${column} IN (${filterArray.map(() => "?").join(", ")})`);
        params.push(...filterArray);
      }
    };

    addArrayFilter("f.status", statusFilter);
    addArrayFilter("f.type", typeFilter);

    // Date range filter
    if (
      activationDateRange &&
      activationDateRange.from &&
      activationDateRange.to
    ) {
      const fromDate = new Date(activationDateRange.from);
      const toDate = new Date(activationDateRange.to);

      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(activation_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    if (creationDateRange && creationDateRange.from && creationDateRange.to) {
      const fromDate = new Date(creationDateRange.from);
      const toDate = new Date(creationDateRange.to);

      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(creation_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    // Construct base query
    let baseQuery = `
      FROM 
          fotovoltaica f
      JOIN
          user u ON f.user_id = u.id 
          
    `;

    // Add WHERE clause if filters exist
    if (filters.length > 0) {
      baseQuery += ` WHERE ` + filters.join(" AND ");
    }

    // Total count query (simplified)
    const countQuery = `
      SELECT COUNT(DISTINCT f.id) AS total
      ${baseQuery}
    `;

    const limitQuery = `LIMIT ? OFFSET ?`;

    // Main query with data retrieval
    const dataQuery = `
      SELECT 
          f.*,
          u.name AS user_name,
          u.email AS user_email
      ${baseQuery}
      GROUP BY 
          f.id
      ORDER BY f.creation_date DESC
      ${rowsPerPage === "Sin Límite" ? "" : typeof rowsPerPage === "number" ? limitQuery : ""}
    `;

    // Add pagination parameters
    const countParams = [...params];
    const dataParams =
      typeof rowsPerPage === "number"
        ? [...params, rowsPerPage, offset]
        : [...params];

    // Execute count query
    const countResult = await tursoClient.execute({
      sql: countQuery,
      args: countParams,
    });
    const total = countResult.rows[0]?.total || 0;

    // Execute data query
    const rs = await tursoClient.execute({
      sql: dataQuery,
      args: dataParams,
    });

    // Process and return results
    return NextResponse.json({
      success: true,
      data: rs.rows.map((row) => {
        const parseArray = (value: string | null) =>
          value ? value.split(",").filter(Boolean) : [];

        return {
          id: row.id,
          client: row.client,
          client_type: row.client_type,
          location: row.location,
          coordinates: parseArray(row.coordinates as string | null),
          type: row.type,
          notes: JSON.parse((row.notes as string) || "[]"),
          internal_notes: JSON.parse((row.internal_notes as string) || "[]"),
          user_id: row.user_id,
          creation_date: row.creation_date,
          status: row.status,
          comision: row.comision || 0,
          comision_sales_person: row.comision_sales_person || 0,
          user: {
            name: row.user_name,
            email: row.user_email,
          },
          activation_date: row.activation_date || null,
        };
      }),
      total,
    });
  } catch (error) {
    console.error(
      "Error en el servidor obteniendo las solicitudes de placas solares",
      error
    );
    return NextResponse.json(
      {
        success: false,
        error:
          "Error en el servidor obteniendo las solicitudes de placas solares",
      },
      { status: 500 }
    );
  }
}
