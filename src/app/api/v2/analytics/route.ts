import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

/**
 * Request/Response Types for Dashboard Analytics
 */
interface DashboardCardValue {
  total: number;
  value: number;
  prev_value: number;
  difference: number;
}

interface DashboardHeroData {
  clients: DashboardCardValue;
  activeTramites: DashboardCardValue;
  comisionesPendientes: number;
  totalBalance: number;
  comparativas: DashboardCardValue;
  totalConsumption: number;
}

interface AnalyticsResponse {
  success: boolean;
  data?: DashboardHeroData;
  error?: string;
}

/**
 * Zod Validation Schema
 */
const AnalyticsRequestSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "User role is required"),
});

/**
 * Creates user filter based on role and subcomercials
 */
const createUserFilter = (
  role: string,
  id: string,
  subcomerciales?: { success: boolean; ids?: string[] },
  includeSubcomerciales: boolean = true
) => {
  const params: (string | number)[] = [];
  let filter = "";

  if (role === "2") {
    if (
      includeSubcomerciales &&
      subcomerciales?.success &&
      subcomerciales.ids
    ) {
      filter = `AND (user_id = ? OR user_id IN (${subcomerciales.ids
        .map(() => "?")
        .join(", ")}))`;
      params.push(id, ...subcomerciales.ids);
    } else {
      filter = `AND user_id = ?`;
      params.push(id);
    }
  } else if (role !== "admin" && role !== "1") {
    filter = `AND user_id = ?`;
    params.push(id);
  }

  return { filter, params };
};

/**
 * Calculates percentage difference between current and previous values
 */
const calculatePercentage = (currentValue: number, previousValue: number) => {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
};

/**
 * Consolidated dashboard analytics endpoint
 * @param request - Next.js request object containing user credentials
 * @returns Promise<NextResponse<AnalyticsResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalyticsResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = AnalyticsRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request parameters: " + validationResult.error.message,
        },
        { status: 400 }
      );
    }

    const { id, role } = validationResult.data;

    // Initialize Turso client
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

    // 1. Query: Client metrics with month-over-month comparison
    const clientsUserFilter = createUserFilter(role, id, subcomerciales);
    const clientsQuery = `
      WITH current_month AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador' 
        AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', datetime('now'))
        ${clientsUserFilter.filter.replace(/AND\s+(user_id)/g, "AND t.$1")}
      ),
      previous_month AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador'
        AND strftime('%Y-%m', t.creation_date) = strftime('%Y-%m', datetime('now', '-1 month'))
        ${clientsUserFilter.filter.replace(/AND\s+(user_id)/g, "AND t.$1")}
      ),
      all_time AS (
        SELECT COUNT(DISTINCT t.client_id) AS total
        FROM tramites t
        WHERE t.status != 'Borrador'
        ${clientsUserFilter.filter.replace(/AND\s+(user_id)/g, "AND t.$1")}
      )
      SELECT 
        a.total AS total,
        COALESCE(c.total, 0) AS current_total,
        COALESCE(p.total, 0) AS prev_total
      FROM all_time a, current_month c, previous_month p;
    `;

    // 2. Query: Active contracts with activation date filtering
    const activeTramitesUserFilter = createUserFilter(role, id, subcomerciales);
    const activeTramitesQuery = `
      WITH current_data AS (
          SELECT 
              SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) AS total,
              SUM(CASE WHEN status = 'Activo' AND strftime('%Y-%m', activation_date) = strftime('%Y-%m', datetime('now')) THEN 1 ELSE 0 END) AS active
          FROM tramites 
          WHERE 1=1 ${activeTramitesUserFilter.filter}
      ),
      previous_data AS (
          SELECT 
              SUM(CASE WHEN status = 'Activo' AND strftime('%Y-%m', activation_date) = strftime('%Y-%m', datetime('now', '-1 month')) THEN 1 ELSE 0 END) AS active
          FROM tramites
          WHERE 1=1 ${role !== "admin" && role !== "1" ? "AND user_id = ?" : ""}
      )
      SELECT 
          cd.total AS total,
          cd.active AS active, 
          COALESCE(pd.active, 0) AS prev_active
      FROM current_data cd
      LEFT JOIN previous_data pd ON 1=1;
    `;

    // 3. Query: Pending commissions based on role
    const comisionesPendientesUserFilter = createUserFilter(
      role,
      id,
      subcomerciales
    );
    const comisionesPendientesQuery = `
      SELECT SUM(CASE WHEN liquidez_status IN (${
        role === "2"
          ? "'Pendiente de Cobro', 'Cobrado por Comercializadora'"
          : "'Pendiente de Cobro'"
      }) THEN 1 ELSE 0 END) AS total
      FROM tramites
      WHERE 1=1 ${comisionesPendientesUserFilter.filter}
    `;

    // 4. Query: Annual balance by month
    const balanceUserFilter = createUserFilter(role, id, subcomerciales);
    const balanceQuery = `
      SELECT 
          strftime('%Y-%m', activation_date) AS month_key,
          SUM(${role === "2" ? "comision_sales_person" : "comision"}) AS total
      FROM tramites
      WHERE strftime('%Y', activation_date) = strftime('%Y', 'now')
      ${balanceUserFilter.filter}
      GROUP BY month_key ORDER BY month_key ASC
    `;

    // 5. Query: Comparison analytics
    const comparativasUserFilter = createUserFilter(role, id, subcomerciales);
    const comparativasQuery = `
      SELECT
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) AS total, 
        SUM(CASE WHEN status = 'processed' AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', datetime('now')) THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'processed' AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', datetime('now', '-1 month')) THEN 1 ELSE 0 END) AS prev_completed
      FROM comparativas
      WHERE 1=1 ${comparativasUserFilter.filter}
    `;

    // 6. Query: Total consumption by month
    const consumptionUserFilter = createUserFilter(role, id, subcomerciales);
    const consumptionQuery = `
      SELECT 
          SUM(c.consumption) AS total
      FROM contracts c
      INNER JOIN tramites t ON c.tramite_id = t.id
      WHERE t.status = 'Activo'
        AND c.new_company IN (SELECT name FROM comercializadoras)
        ${consumptionUserFilter.filter.replace(/AND\s+(user_id)/g, "AND t.$1")}
    `;
    // Execute all queries in parallel for optimal performance
    const [
      clientsResult,
      activeTramitesResult,
      comisionesPendientesResult,
      balanceResult,
      comparativasResult,
      totalConsumptionResult,
    ] = await Promise.all([
      tursoClient.execute({
        sql: clientsQuery,
        args: [
          ...clientsUserFilter.params,
          ...clientsUserFilter.params,
          ...clientsUserFilter.params,
        ],
      }),
      tursoClient.execute({
        sql: activeTramitesQuery,
        args: [
          ...activeTramitesUserFilter.params,
          ...(role !== "admin" && role !== "1" ? [id] : []),
        ],
      }),
      tursoClient.execute({
        sql: comisionesPendientesQuery,
        args: comisionesPendientesUserFilter.params,
      }),
      tursoClient.execute({
        sql: balanceQuery,
        args: balanceUserFilter.params,
      }),
      tursoClient.execute({
        sql: comparativasQuery,
        args: comparativasUserFilter.params,
      }),
      tursoClient.execute({
        sql: consumptionQuery,
        args: consumptionUserFilter.params,
      }),
    ]);

    // Process clients data
    const clientsData = clientsResult.rows[0] || {
      total: 0,
      current_total: 0,
      prev_total: 0,
    };
    const clientsDifference = calculatePercentage(
      Number(clientsData.current_total || 0),
      Number(clientsData.prev_total || 0)
    );

    // Process active contracts data
    const activeTramitesData = activeTramitesResult.rows[0] || {
      total: 0,
      active: 0,
      prev_active: 0,
    };
    const activeTramitesDifference = calculatePercentage(
      Number(activeTramitesData.active || 0),
      Number(activeTramitesData.prev_active || 0)
    );

    // Process pending commissions
    const comisionesPendientes = Number(
      comisionesPendientesResult.rows[0]?.total || 0
    );

    // Process annual balance calculation
    const balanceData = balanceResult.rows;
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
    balanceData.forEach((row) => {
      const [, month] = String(row.month_key).split("-");
      comisionesMap.set(month, row.total as number);
    });

    const balanceArray = monthNames.map((month, index) => {
      const monthKey = String(index + 1).padStart(2, "0");
      return {
        month,
        total: comisionesMap.get(monthKey) || 0,
      };
    });

    const totalBalance = balanceArray.reduce(
      (acc, item) => acc + item.total,
      0
    );

    // Process comparisons data
    const comparativasData = comparativasResult.rows[0] || {
      total: 0,
      completed: 0,
      prev_completed: 0,
    };
    const comparativasDifference = calculatePercentage(
      Number(comparativasData.completed || 0),
      Number(comparativasData.prev_completed || 0)
    );

    // Process total consumption data
    const totalConsumptionData =
      Number(totalConsumptionResult.rows[0]?.total) || 0;
    // Build response maintaining exact structure compatibility
    const heroData: DashboardHeroData = {
      clients: {
        total: Number(clientsData.total || 0),
        value: Number(clientsData.current_total || 0),
        prev_value: Number(clientsData.prev_total || 0),
        difference: clientsDifference,
      },
      activeTramites: {
        total: Number(activeTramitesData.total || 0),
        value: Number(activeTramitesData.active || 0),
        prev_value: Number(activeTramitesData.prev_active || 0),
        difference: activeTramitesDifference,
      },
      comisionesPendientes,
      totalBalance,
      comparativas: {
        total: Number(comparativasData.total || 0),
        value: Number(comparativasData.completed || 0),
        prev_value: Number(comparativasData.prev_completed || 0),
        difference: comparativasDifference,
      },
      totalConsumption: totalConsumptionData,
    };

    return NextResponse.json({
      success: true,
      data: heroData,
    });
  } catch (error) {
    console.error("Error fetching dashboard analytics data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching dashboard analytics data",
      },
      { status: 500 }
    );
  }
}
