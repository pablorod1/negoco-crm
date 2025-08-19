import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { TimeRange } from "@/core/types";
import { DateRange } from "react-day-picker";

// Response Types
interface PersonalContractsResponse {
  success: boolean;
  data?: ContractAnalyticsData[];
  error?: string;
}

interface ContractAnalyticsData {
  field: string;
  active: number;
  baja: number;
  comision?: number;
  comision_sales_person?: number;
}

// Zod Validation Schemas
const PersonalContractsRequestSchema = z.object({
  role: z.string().min(1, "Role is required"),
  id: z.string().min(1, "User ID is required"),
  isSubcomercial: z.boolean(),
  time_range: z
    .enum(["year", "current_month", "current_week", "last_week", "90d"])
    .optional(),
  date_range: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
});

/**
 * Retrieves personal contract analytics data by user
 * @param request - Next.js request object
 * @returns Promise<NextResponse<PersonalContractsResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<PersonalContractsResponse>> {
  try {
    const body = await request.json();

    // Validate request body
    const validation = PersonalContractsRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validation.error.errors.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { role, id, isSubcomercial, time_range, date_range } =
      validation.data;

    // Get database client
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

    // Build dynamic query based on role and permissions
    let query = `
      SELECT 
        date(activation_date) as date,
        COUNT(CASE WHEN status = 'Activo' THEN 1 ELSE NULL END) as active,
        COUNT(CASE WHEN status = 'Baja' THEN 1 ELSE NULL END) as baja
        ${role !== "2" ? ",SUM(comision) as comision" : ""}
        ${!isSubcomercial ? ",SUM(comision_sales_person) as comision_sales_person" : ""}
      FROM tramites
      WHERE user_id = ?`;

    const conditions: string[] = [];
    const params: (string | number)[] = [id];
    let groupBy: string | undefined;

    // Add time range conditions
    if (time_range) {
      switch (time_range) {
        case "year":
          conditions.push(`activation_date >= date('now', 'start of year')`);
          groupBy = `strftime('%m', activation_date)`;
          break;
        case "current_month":
          conditions.push(
            `strftime('%Y-%m', activation_date) = strftime('%Y-%m', 'now')`
          );
          groupBy = `strftime('%d', activation_date)`;
          break;
        case "current_week":
          conditions.push(
            `strftime('%Y-%W', activation_date) = strftime('%Y-%W', 'now')`
          );
          groupBy = `strftime('%w', activation_date)`;
          break;
        case "last_week":
          conditions.push(
            `strftime('%Y-%W', activation_date) = strftime('%Y-%W', 'now', '-7 days')`
          );
          groupBy = `strftime('%w', activation_date)`;
          break;
        case "90d":
          conditions.push(`activation_date >= date('now', '-90 days')`);
          groupBy = `date(activation_date)`;
          break;
      }
    }

    // Add custom date range conditions
    if (date_range?.from && date_range?.to) {
      conditions.push(`date(activation_date) BETWEEN date(?) AND date(?)`);
      params.push(date_range.from, date_range.to);
      groupBy = `date(activation_date)`;
    }

    // Apply conditions to query
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(" AND ")}`;
    }

    // Add grouping and ordering
    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
    }
    query += ` ORDER BY date(activation_date)`;

    // Execute query
    const rs = await tursoClient.execute({ sql: query, args: params });

    // Process results based on time range
    const results = new Map<string, Omit<ContractAnalyticsData, "field">>();

    // Initialize results structure based on time range
    const convertedDateRange =
      date_range && date_range.from && date_range.to
        ? { from: new Date(date_range.from), to: new Date(date_range.to) }
        : undefined;
    initializeResultsStructure(results, time_range, convertedDateRange);

    // Populate results with query data
    populateResults(results, rs.rows, time_range, convertedDateRange);

    // Convert to response format
    const data: ContractAnalyticsData[] = Array.from(results.entries()).map(
      ([field, values]) => ({
        field,
        active: values.active,
        baja: values.baja,
        comision: values.comision,
        comision_sales_person: values.comision_sales_person,
      })
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching personal contract analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching personal contract analytics",
      },
      { status: 500 }
    );
  }
}

/**
 * Initialize results structure based on time range
 */
function initializeResultsStructure(
  results: Map<string, Omit<ContractAnalyticsData, "field">>,
  timeRange?: TimeRange,
  dateRange?: DateRange
): void {
  const defaultData = {
    active: 0,
    baja: 0,
    comision: 0,
    comision_sales_person: 0,
  };

  if (timeRange === "current_week" || timeRange === "last_week") {
    const weekStart =
      timeRange === "current_week"
        ? new Date()
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dayStr = day.toLocaleDateString("es-ES", { weekday: "long" });
      results.set(dayStr, { ...defaultData });
    }
  } else if (timeRange === "current_month") {
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      results.set(`${i}`, { ...defaultData });
    }
  } else if (timeRange === "year") {
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

    months.forEach((month) => results.set(month, { ...defaultData }));
  } else if (timeRange === "90d") {
    for (let i = 89; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
      });
      results.set(dayStr, { ...defaultData });
    }
  } else if (dateRange?.from && dateRange?.to) {
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);

    for (
      let date = new Date(fromDate);
      date <= toDate;
      date.setDate(date.getDate() + 1)
    ) {
      const dateStr = date.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
      });
      results.set(dateStr, { ...defaultData });
    }
  }
}

/**
 * Populate results with query data
 */
function populateResults(
  results: Map<string, Omit<ContractAnalyticsData, "field">>,
  rows: Record<string, unknown>[],
  timeRange?: TimeRange,
  dateRange?: DateRange
): void {
  rows.forEach((row) => {
    const date = new Date(row.date as string);
    let key: string;

    if (timeRange === "current_week" || timeRange === "last_week") {
      key = date.toLocaleDateString("es-ES", { weekday: "long" });
    } else if (timeRange === "current_month") {
      key = `${date.getDate()}`;
    } else if (timeRange === "year") {
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
      key = months[date.getMonth()];
    } else if (timeRange === "90d" || (dateRange?.from && dateRange?.to)) {
      key = date.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
      });
    } else {
      key = row.date as string;
    }

    if (results.has(key)) {
      results.set(key, {
        active: Number(row.active || 0),
        baja: Number(row.baja || 0),
        comision: Number(row.comision || 0),
        comision_sales_person: Number(row.comision_sales_person || 0),
      });
    }
  });
}
