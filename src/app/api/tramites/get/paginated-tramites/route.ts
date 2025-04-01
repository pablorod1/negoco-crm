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
      activationDateRange,
      creationDateRange,
      renovationDateRange,
      collectionDateRange,
      paymentDateRange,
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
      activationDateRange?: DateRange | undefined;
      creationDateRange?: DateRange | undefined;
      renovationDateRange?: DateRange | undefined;
      collectionDateRange?: DateRange | undefined;
      paymentDateRange?: DateRange | undefined;
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

    const offset = (page - 1) * rowsPerPage;
    const filters: string[] = [];
    const params: (string | number)[] = [];

    // User role-based filtering
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

    // Dynamic text filter
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
          "t.id",
          "t.sales_name",
          "c.name",
          "c.last_name",
          "c.email",
          "con.CUPS",
        ],
        filterValue
      );
    }

    // Array-based filters
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

    if (
      renovationDateRange &&
      renovationDateRange.from &&
      renovationDateRange.to
    ) {
      const fromDate = new Date(renovationDateRange.from);
      const toDate = new Date(renovationDateRange.to);

      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(renovation_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    if (
      collectionDateRange &&
      collectionDateRange.from &&
      collectionDateRange.to
    ) {
      const fromDate = new Date(collectionDateRange.from);
      const toDate = new Date(collectionDateRange.to);

      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(collection_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    if (paymentDateRange && paymentDateRange.from && paymentDateRange.to) {
      const fromDate = new Date(paymentDateRange.from);
      const toDate = new Date(paymentDateRange.to);

      fromDate.setDate(fromDate.getDate() + 1);
      toDate.setDate(toDate.getDate() + 1);

      filters.push(`date(payment_date) BETWEEN date(?) AND date(?)`);
      params.push(
        fromDate.toISOString().split("T")[0],
        toDate.toISOString().split("T")[0]
      );
    }

    // Construct base query
    let baseQuery = `
      FROM 
          tramites t
      LEFT JOIN 
          clients c ON t.client_id = c.id
      LEFT JOIN 
          contracts con ON t.id = con.tramite_id
    `;

    // Add WHERE clause if filters exist
    if (filters.length > 0) {
      baseQuery += ` WHERE ` + filters.join(" AND ");
    }

    // Total count query (simplified)
    const countQuery = `
      SELECT COUNT(DISTINCT t.id) AS total
      ${baseQuery}
    `;

    // Main query with data retrieval
    const dataQuery = `
      SELECT 
          t.id AS id,
          t.creation_date AS creation_date,
          t.activation_date AS activation_date,
          t.renovation_date AS renovation_date,
          t.collection_date AS collection_date,
          t.payment_date AS payment_date,
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
      ${baseQuery}
      GROUP BY 
          t.id, t.creation_date, t.renovation_date, t.sales_name, 
          t.comision_sales_person, t.comision, t.status, t.liquidez_status,
          c.name, c.last_name, c.email
      ORDER BY t.creation_date DESC
      LIMIT ? OFFSET ?
    `;

    // Add pagination parameters
    const countParams = [...params];
    const dataParams = [...params, rowsPerPage, offset];

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
          activation_date: row.activation_date as string,
          renovation_date: row.renovation_date as string,
          collection_date: row.collection_date,
          payment_date: row.payment_date,
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
