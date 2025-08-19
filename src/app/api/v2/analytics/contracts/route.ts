import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import type { Client } from "@libsql/client";

/**
 * Response Types for Contract Analytics
 */
interface ContractMetrics {
  total: number;
  value: number;
  prev_value: number;
  difference: number;
}

interface ContractAnalyticsResponse {
  success: boolean;
  data?: ContractMetrics | number | MonthlyBalance[];
  error?: string;
}

interface MonthlyBalance {
  month: string;
  total: number;
}

/**
 * Zod Validation Schema
 */
const ContractAnalyticsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "User role is required"),
  metric: z
    .enum([
      "clients-count",
      "active-pending",
      "comisiones-pendientes",
      "monthly-comisiones",
      "total-consumption",
    ])
    .optional()
    .default("clients-count"),
});

/**
 * Creates user filter with subcomerciales support
 */
const createUserFilter = (
  role: string,
  id: string,
  subcomerciales?: { success: boolean; ids?: string[] }
) => {
  const params: (string | number)[] = [];
  let filter = "";

  if (role === "2") {
    if (subcomerciales?.success && subcomerciales.ids) {
      filter = `(user_id = ? OR user_id IN (${subcomerciales.ids
        .map(() => "?")
        .join(", ")}))`;
      params.push(id, ...subcomerciales.ids);
    } else {
      filter = `user_id = ?`;
      params.push(id);
    }
  } else if (role !== "admin" && role !== "1") {
    filter = `user_id = ?`;
    params.push(id);
  }

  return { filter, params };
};

/**
 * Calculates percentage difference
 */
const calculatePercentage = (currentValue: number, previousValue: number) => {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
};

/**
 * Gets clients count metrics (legacy: /api/tramites/get/clients-count)
 */
const getClientsCountMetrics = async (
  tursoClient: Client,
  role: string,
  id: string,
  subcomerciales?: { success: boolean; ids?: string[] }
): Promise<ContractMetrics> => {
  const userFilter = createUserFilter(role, id, subcomerciales);
  const whereClause = userFilter.filter ? `AND t.${userFilter.filter}` : "";

  const query = `
    WITH current_month AS (
      SELECT COUNT(DISTINCT t.client_id) AS total
      FROM tramites t
      WHERE t.status != 'Borrador' 
      AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', datetime('now'))
      ${whereClause}
    ),
    previous_month AS (
      SELECT COUNT(DISTINCT t.client_id) AS total
      FROM tramites t
      WHERE t.status != 'Borrador'
      AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', datetime('now', '-1 month'))
      ${whereClause}
    ),
    all_time AS (
      SELECT COUNT(DISTINCT t.client_id) AS total
      FROM tramites t
      WHERE t.status != 'Borrador'
      ${whereClause}
    )
    SELECT 
      a.total AS total,
      COALESCE(c.total, 0) AS current_total,
      COALESCE(p.total, 0) AS prev_total
    FROM all_time a, current_month c, previous_month p;
  `;

  const params = [
    ...userFilter.params,
    ...userFilter.params,
    ...userFilter.params,
  ];

  const result = await tursoClient.execute({ sql: query, args: params });
  const data = result.rows[0] || { total: 0, current_total: 0, prev_total: 0 };

  const difference = calculatePercentage(
    Number(data.current_total || 0),
    Number(data.prev_total || 0)
  );

  return {
    total: Number(data.total || 0),
    value: Number(data.current_total || 0),
    prev_value: Number(data.prev_total || 0),
    difference,
  };
};

/**
 * Gets active/pending contracts metrics (legacy: /api/tramites/get/active-pending)
 */
const getActivePendingMetrics = async (
  tursoClient: Client,
  role: string,
  id: string,
  subcomerciales?: { success: boolean; ids?: string[] }
): Promise<ContractMetrics> => {
  const userFilter = createUserFilter(role, id, subcomerciales);
  const whereClause = userFilter.filter ? `WHERE ${userFilter.filter}` : "";
  const whereClauseSecond =
    role !== "admin" && role !== "1" ? `WHERE user_id = ?` : "";

  const query = `
    WITH current_data AS (
        SELECT 
            SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) AS total,
            SUM(CASE WHEN status = 'Activo' AND strftime('%Y-%m', activation_date) = strftime('%Y-%m', datetime('now')) THEN 1 ELSE 0 END) AS active
        FROM tramites 
        ${whereClause}
    ),
    previous_data AS (
        SELECT 
            SUM(CASE WHEN status = 'Activo' AND strftime('%Y-%m', activation_date) = strftime('%Y-%m', datetime('now', '-1 month')) THEN 1 ELSE 0 END) AS active
        FROM tramites
        ${whereClauseSecond}
    )
    SELECT 
        cd.total AS total,
        cd.active AS active, 
        COALESCE(pd.active, 0) AS prev_active
    FROM current_data cd
    LEFT JOIN previous_data pd ON 1=1;
  `;

  const params = [
    ...userFilter.params,
    ...(role !== "admin" && role !== "1" ? [id] : []),
  ];

  const result = await tursoClient.execute({ sql: query, args: params });
  const data = result.rows[0] || { total: 0, active: 0, prev_active: 0 };

  const difference = calculatePercentage(
    Number(data.active || 0),
    Number(data.prev_active || 0)
  );

  return {
    total: Number(data.total || 0),
    value: Number(data.active || 0),
    prev_value: Number(data.prev_active || 0),
    difference,
  };
};

/**
 * Gets pending commissions count (legacy: /api/tramites/get/comisiones-pendientes)
 */
const getPendingCommissions = async (
  tursoClient: Client,
  role: string,
  id: string,
  subcomerciales?: { success: boolean; ids?: string[] }
): Promise<number> => {
  const userFilter = createUserFilter(role, id, subcomerciales);
  const whereClause = userFilter.filter ? `WHERE ${userFilter.filter}` : "";

  const query = `
    SELECT SUM(CASE WHEN liquidez_status IN (${
      role === "2"
        ? "'Pendiente de Cobro', 'Cobrado por Comercializadora'"
        : "'Pendiente de Cobro'"
    }) THEN 1 ELSE 0 END) AS total
    FROM tramites
    ${whereClause}
  `;

  const result = await tursoClient.execute({
    sql: query,
    args: userFilter.params,
  });

  return Number(result.rows[0]?.total || 0);
};

/**
 * Gets monthly commissions balance (legacy: /api/tramites/get/monthly-comisiones)
 */
const getMonthlyCommissions = async (
  tursoClient: Client,
  role: string,
  id: string,
  subcomerciales?: { success: boolean; ids?: string[] }
): Promise<MonthlyBalance[]> => {
  const userFilter = createUserFilter(role, id, subcomerciales);
  const whereClause = userFilter.filter ? `AND ${userFilter.filter}` : "";

  const query = `
    SELECT 
        strftime('%Y-%m', activation_date) AS month_key,
        SUM(${role === "2" ? "comision_sales_person" : "comision"}) AS total
    FROM tramites
    WHERE strftime('%Y', activation_date) = strftime('%Y', 'now')
    ${whereClause}
    GROUP BY month_key ORDER BY month_key ASC
  `;

  const result = await tursoClient.execute({
    sql: query,
    args: userFilter.params,
  });

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

  const comisionesMap = new Map<string, number>();
  result.rows.forEach((row: Record<string, unknown>) => {
    const [, month] = String(row.month_key).split("-");
    comisionesMap.set(month, row.total as number);
  });

  return monthNames.map((month, index) => {
    const monthKey = String(index + 1).padStart(2, "0");
    return {
      month,
      total: comisionesMap.get(monthKey) || 0,
    };
  });
};

/**
 * Gets yearly total consumption
 */

const getYearlyConsumption = async (
  tursoClient: Client,
  role: string,
  id: string,
  subcomerciales?: { success: boolean; ids?: string[] }
): Promise<number> => {
  const userFilter = createUserFilter(role, id, subcomerciales);
  const whereClause = userFilter.filter ? `WHERE ${userFilter.filter}` : "";

  const query = `
    SELECT SUM(consumption) AS total
    FROM tramites
    ${whereClause}
  `;

  const result = await tursoClient.execute({
    sql: query,
    args: userFilter.params,
  });

  return Number(result.rows[0]?.total || 0);
};

/**
 * Unified contract analytics endpoint
 * Handles multiple contract-related analytics queries
 * @param request - Next.js request object
 * @returns Promise<NextResponse<ContractAnalyticsResponse>>
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ContractAnalyticsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = {
      id: searchParams.get("id") || "",
      role: searchParams.get("role") || "",
      metric: searchParams.get("metric") || "clients-count",
    };

    const validationResult = ContractAnalyticsSchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters: " + validationResult.error.message,
        },
        { status: 400 }
      );
    }

    const { id, role, metric } = validationResult.data;

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Get subcomerciales for role "2"
    let subcomerciales: { success: boolean; ids?: string[] } = {
      success: false,
    };
    if (role === "2") {
      subcomerciales = await getSubcomerciales(tursoClient, id);
    }

    let data: ContractMetrics | number | MonthlyBalance[];

    // Route to appropriate analytics function based on metric
    switch (metric) {
      case "clients-count":
        data = await getClientsCountMetrics(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
      case "active-pending":
        data = await getActivePendingMetrics(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
      case "comisiones-pendientes":
        data = await getPendingCommissions(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
      case "monthly-comisiones":
        data = await getMonthlyCommissions(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
      case "total-consumption":
        data = await getYearlyConsumption(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid metric parameter",
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching contract analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching contract analytics",
      },
      { status: 500 }
    );
  }
}

/**
 * POST method for backward compatibility with legacy endpoints
 * Handles clients-count, comisiones-pendientes, and monthly-comisiones
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ContractAnalyticsResponse>> {
  try {
    const body = await request.json();
    const validationResult = ContractAnalyticsSchema.omit({
      metric: true,
    }).safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const { id, role } = validationResult.data;

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Determine metric type from URL path or default to monthly-comisiones
    const url = new URL(request.url);
    let metric = "monthly-comisiones"; // Default for dashboard balance chart

    // Check if this is a specific metric request based on calling pattern
    if (url.searchParams.get("metric")) {
      metric = url.searchParams.get("metric")!;
    }

    let subcomerciales: { success: boolean; ids?: string[] } = {
      success: false,
    };
    if (role === "2") {
      subcomerciales = await getSubcomerciales(tursoClient, id);
    }

    let data: ContractMetrics | number | MonthlyBalance[];

    switch (metric) {
      case "clients-count":
        data = await getClientsCountMetrics(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
      case "comisiones-pendientes":
        data = await getPendingCommissions(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
      case "monthly-comisiones":
        data = await getMonthlyCommissions(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
      case "total-consumption":
        data = await getYearlyConsumption(
          tursoClient,
          role,
          id,
          subcomerciales
        );
      default:
        data = await getMonthlyCommissions(
          tursoClient,
          role,
          id,
          subcomerciales
        );
        break;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching contract analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching contract analytics",
      },
      { status: 500 }
    );
  }
}
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<ContractAnalyticsResponse>> {
  try {
    const body = await request.json();
    const validationResult = ContractAnalyticsSchema.omit({
      metric: true,
    }).safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const { id, role } = validationResult.data;

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    let subcomerciales: { success: boolean; ids?: string[] } = {
      success: false,
    };
    if (role === "2") {
      subcomerciales = await getSubcomerciales(tursoClient, id);
    }

    const data = await getActivePendingMetrics(
      tursoClient,
      role,
      id,
      subcomerciales
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching user data",
      },
      { status: 500 }
    );
  }
}
