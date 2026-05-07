import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import type { Client } from "@libsql/client";

/**
 * Response Types for Comparison Analytics
 */
interface ComparisonMetrics {
  total: number;
  value: number;
  prev_value: number;
  difference: number;
}

interface ConversionRatio {
  total: number;
  processed: number;
}

interface ComparisonsByStatus {
  client: string;
  creation_date: string;
  status: string;
  id: string;
  user: {
    name: string;
    image: string;
  };
}

interface ComparisonAnalyticsResponse {
  success: boolean;
  data?: ComparisonMetrics | ConversionRatio[] | ComparisonsByStatus[];
  error?: string;
}

/**
 * Zod Validation Schema
 */
const ComparisonAnalyticsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  role: z.string().min(1, "User role is required"),
  metric: z
    .enum(["completed-count", "converted-ratio", "by-status"])
    .optional()
    .default("completed-count"),
  month: z.string().optional(), // Required for converted-ratio
  status: z.string().optional(), // Required for by-status
  commercialId: z.string().optional(),
});

type SubcomercialesResult = { success: boolean; ids?: string[] };

/**
 * Creates user filter with subcomerciales support
 */
const createUserFilter = (
  role: string,
  id: string,
  subcomerciales?: SubcomercialesResult,
  commercialId?: string,
  userColumn = "user_id",
) => {
  const params: (string | number)[] = [];
  const filters: string[] = [];
  const selectedCommercialId =
    commercialId && commercialId !== "all" ? commercialId : "";

  if (role === "2") {
    if (subcomerciales?.success && subcomerciales.ids?.length) {
      filters.push(
        `(${userColumn} = ? OR ${userColumn} IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")}))`,
      );
      params.push(id, ...subcomerciales.ids);
    } else {
      filters.push(`${userColumn} = ?`);
      params.push(id);
    }
  }

  if (selectedCommercialId) {
    filters.push(`${userColumn} = ?`);
    params.push(selectedCommercialId);
  }

  return { filter: filters.join(" AND "), params };
};

/**
 * Calculates percentage difference
 */
const calculatePercentage = (currentValue: number, previousValue: number) => {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
};

/**
 * Gets completed comparisons count (legacy: /api/comparativas/get/completed-count)
 */
const getCompletedCountMetrics = async (
  tursoClient: Client,
  role: string,
  id: string,
  subcomerciales?: SubcomercialesResult,
): Promise<ComparisonMetrics> => {
  const userFilter = createUserFilter(role, id, subcomerciales);
  const whereClause = userFilter.filter ? `AND ${userFilter.filter}` : "";

  const query = `
    SELECT
      SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) AS total, 
      SUM(CASE WHEN status = 'processed' AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', datetime('now')) THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'processed' AND strftime('%Y-%m', creation_date) = strftime('%Y-%m', datetime('now', '-1 month')) THEN 1 ELSE 0 END) AS prev_completed
    FROM comparativas
    WHERE 1=1 ${whereClause}
  `;

  const result = await tursoClient.execute({
    sql: query,
    args: userFilter.params,
  });

  const data = result.rows[0] || {
    total: 0,
    completed: 0,
    prev_completed: 0,
  };

  const completedDifference = calculatePercentage(
    Number(data.completed || 0),
    Number(data.prev_completed || 0),
  );

  return {
    total: Number(data.total || 0),
    value: Number(data.completed || 0),
    prev_value: Number(data.prev_completed || 0),
    difference: completedDifference,
  };
};

/**
 * Gets conversion ratio (legacy: /api/comparativas/get/converted-ratio)
 */
const getConversionRatio = async (
  tursoClient: Client,
  role: string,
  id: string,
  month: string,
  subcomerciales?: SubcomercialesResult,
  commercialId?: string,
): Promise<ConversionRatio[]> => {
  const userFilter = createUserFilter(
    role,
    id,
    subcomerciales,
    commercialId,
    "c.user_id",
  );
  const whereClause = userFilter.filter ? `AND ${userFilter.filter}` : "";

  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END), 0) AS total,
      COALESCE(SUM(CASE WHEN c.status = 'processed' THEN 1 ELSE 0 END), 0) AS processed
    FROM comparativas c
    WHERE strftime('%m', c.creation_date) = strftime('%m', ?)
      AND strftime('%Y', c.creation_date) = strftime('%Y', 'now') 
      AND c.status IN ('completed', 'processed')
      ${whereClause}
  `;

  const params = [month, ...userFilter.params];

  const result = await tursoClient.execute({
    sql: query,
    args: params,
  });

  return result.rows.map((row: Record<string, unknown>) => ({
    total: Number(row.total || 0),
    processed: Number(row.processed || 0),
  }));
};

/**
 * Gets comparisons by status (legacy: /api/comparativas/get/by-status)
 */
const getComparisonsByStatus = async (
  tursoClient: Client,
  role: string,
  id: string,
  status: string,
  subcomerciales?: SubcomercialesResult,
): Promise<ComparisonsByStatus[]> => {
  const params: (string | number)[] = [];
  const whereConditions: string[] = [];

  let query = `
    SELECT 
      c.client, 
      c.creation_date,
      c.status,
      c.id,
      u.name as user_name,
      u.image as user_image
    FROM comparativas c
    LEFT JOIN user u ON c.user_id = u.id
  `;

  // Apply status filtering
  if (status !== "all") {
    whereConditions.push("c.status = ?");
    params.push(status);
    if (status === "completed") {
      whereConditions.push("strftime(c.creation_date) = strftime('now')");
    }
  }

  // Apply user filtering
  const userFilter = createUserFilter(
    role,
    id,
    subcomerciales,
    undefined,
    "c.user_id",
  );
  if (userFilter.filter) {
    whereConditions.push(userFilter.filter);
    params.push(...userFilter.params);
  }

  if (whereConditions.length > 0) {
    query += ` WHERE ${whereConditions.join(" AND ")}`;
  }

  const result = await tursoClient.execute({
    sql: query,
    args: params,
  });

  return result.rows.map((row: Record<string, unknown>) => ({
    client: row.client as string,
    creation_date: row.creation_date as string,
    status: row.status as string,
    id: row.id as string,
    user: {
      name: (row.user_name as string) || "",
      image: (row.user_image as string) || "",
    },
  }));
};

/**
 * Unified comparison analytics endpoint
 * Handles multiple comparison-related analytics queries
 * @param request - Next.js request object
 * @returns Promise<NextResponse<ComparisonAnalyticsResponse>>
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ComparisonAnalyticsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = {
      id: searchParams.get("id") || "",
      role: searchParams.get("role") || "",
      metric: searchParams.get("metric") || "completed-count",
      month: searchParams.get("month") || "",
      status: searchParams.get("status") || "",
      commercialId:
        searchParams.get("commercialId") ||
        searchParams.get("commercial_id") ||
        "",
    };

    const validationResult = ComparisonAnalyticsSchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters: " + validationResult.error.message,
        },
        { status: 400 },
      );
    }

    const { id, role, metric, month, status, commercialId } =
      validationResult.data;

    // Validate required parameters based on metric
    if (metric === "converted-ratio" && !month) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters. El mes (month) es obligatorio.",
        },
        { status: 400 },
      );
    }

    if (metric === "by-status" && !status) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters. Status is required.",
        },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 },
      );
    }

    // Get subcomerciales for role "2"
    let subcomerciales: SubcomercialesResult = {
      success: false,
    };
    if (role === "2") {
      subcomerciales = await getSubcomerciales(tursoClient, id);
    }

    let data: ComparisonMetrics | ConversionRatio[] | ComparisonsByStatus[];

    // Route to appropriate analytics function based on metric
    switch (metric) {
      case "completed-count":
        data = await getCompletedCountMetrics(
          tursoClient,
          role,
          id,
          subcomerciales,
        );
        break;
      case "converted-ratio":
        if (month) {
          data = await getConversionRatio(
            tursoClient,
            role,
            id,
            month,
            subcomerciales,
            commercialId,
          );
        } else {
          return NextResponse.json(
            {
              success: false,
              error: "Month parameter is required for converted-ratio metric",
            },
            { status: 400 },
          );
        }
        break;
      case "by-status":
        if (status) {
          data = await getComparisonsByStatus(
            tursoClient,
            role,
            id,
            status,
            subcomerciales,
          );
        } else {
          return NextResponse.json(
            {
              success: false,
              error: "Status parameter is required for by-status metric",
            },
            { status: 400 },
          );
        }
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid metric parameter",
          },
          { status: 400 },
        );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching comparison analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching comparison analytics",
      },
      { status: 500 },
    );
  }
}

/**
 * POST methods for backward compatibility with legacy endpoints
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ComparisonAnalyticsResponse>> {
  try {
    const body = await request.json();

    // Determine which legacy endpoint is being called based on request body
    if (body.month !== undefined) {
      // Legacy: /api/comparativas/get/converted-ratio
      const validationResult = ComparisonAnalyticsSchema.omit({ metric: true })
        .extend({ month: z.string().min(1, "Month is required") })
        .safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing parameters. El mes (month) es obligatorio.",
          },
          { status: 400 },
        );
      }

      const { id, role, month } = validationResult.data;
      const tursoClient = getTursoClient(request);

      if (!tursoClient) {
        return NextResponse.json(
          {
            success: false,
            error: "Database client not initialized",
          },
          { status: 500 },
        );
      }

      let subcomerciales: { success: boolean; ids?: string[] } = {
        success: false,
      };
      if (role === "2") {
        subcomerciales = await getSubcomerciales(tursoClient, id);
      }

      const data = await getConversionRatio(
        tursoClient,
        role,
        id,
        month,
        subcomerciales,
        body.commercialId || body.commercial_id || "",
      );
      return NextResponse.json({ success: true, data });
    } else if (body.status !== undefined) {
      // Legacy: /api/comparativas/get/by-status
      const validationResult = ComparisonAnalyticsSchema.omit({ metric: true })
        .extend({ status: z.string().min(1, "Status is required") })
        .safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          { success: false, error: "Missing parameters" },
          { status: 400 },
        );
      }

      const { id, role, status } = validationResult.data;
      const tursoClient = getTursoClient(request);

      if (!tursoClient) {
        return NextResponse.json(
          { success: false, error: "Database client not initialized" },
          { status: 500 },
        );
      }

      let subcomerciales: { success: boolean; ids?: string[] } = {
        success: false,
      };
      if (role === "2") {
        subcomerciales = await getSubcomerciales(tursoClient, id);
      }

      const data = await getComparisonsByStatus(
        tursoClient,
        role,
        id,
        status,
        subcomerciales,
      );
      return NextResponse.json({ success: true, data });
    } else {
      // Legacy: /api/comparativas/get/completed-count
      const validationResult = ComparisonAnalyticsSchema.omit({
        metric: true,
        month: true,
        status: true,
      }).safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing parameters",
          },
          { status: 400 },
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
          { status: 500 },
        );
      }

      let subcomerciales: { success: boolean; ids?: string[] } = {
        success: false,
      };
      if (role === "2") {
        subcomerciales = await getSubcomerciales(tursoClient, id);
      }

      const data = await getCompletedCountMetrics(
        tursoClient,
        role,
        id,
        subcomerciales,
      );
      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error("Error fetching comparison analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching comparison analytics",
      },
      { status: 500 },
    );
  }
}
