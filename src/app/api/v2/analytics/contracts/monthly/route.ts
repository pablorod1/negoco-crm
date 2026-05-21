import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import {
  executeReadWithRetry,
  isRetryableLibsqlError,
} from "@/core/libsql/executeWithRetry";
import { TimeRange } from "@/core/types";
import { DateRange } from "react-day-picker";

// Response Types
interface MonthlyContractsResponse {
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

const MONTH_NAMES = [
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

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getWeekStart = (date: Date) => {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + offset);
  return weekStart;
};

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const getDateLabel = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;

  return new Date(year, month - 1, day).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const getMonthLabel = (monthKey: string) => {
  const month =
    monthKey.length === 2 ? Number(monthKey) : Number(monthKey.split("-")[1]);
  return MONTH_NAMES[month - 1] ?? monthKey;
};

const databaseUnavailableResponse = () =>
  NextResponse.json(
    {
      success: false,
      error: "Base de datos temporalmente no disponible",
    },
    {
      status: 503,
      headers: {
        "Retry-After": "1",
      },
    },
  );

// Zod Validation Schemas
const MonthlyContractsRequestSchema = z.object({
  role: z.string().min(1, "Role is required"),
  id: z.string().min(1, "User ID is required"),
  time_range: z
    .enum(["year", "current_month", "current_week", "last_week", "90d"])
    .optional(),
  date_range: z
    .object({
      from: z
        .string()
        .refine((date) => !isNaN(Date.parse(date)), "Invalid from date format")
        .optional(),
      to: z
        .string()
        .refine((date) => !isNaN(Date.parse(date)), "Invalid to date format")
        .optional(),
    })
    .optional(),
});

/**
 * Retrieves monthly contract analytics data (all users)
 * @param request - Next.js request object
 * @returns Promise<NextResponse<MonthlyContractsResponse>>
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<MonthlyContractsResponse>> {
  try {
    const body = await request.json();

    // Validate request body
    const validation = MonthlyContractsRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validation.error.issues.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { time_range, date_range } = validation.data;

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

    let dateExpression = "substr(activation_date, 1, 10)";
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let groupBy: string | undefined;

    // Add time range conditions
    if (time_range) {
      const now = new Date();

      switch (time_range) {
        case "year":
          dateExpression = "substr(activation_date, 6, 2)";
          conditions.push(`substr(activation_date, 1, 4) = ?`);
          params.push(String(now.getFullYear()));
          groupBy = dateExpression;
          break;
        case "current_month":
          dateExpression = "substr(activation_date, 1, 10)";
          conditions.push(`substr(activation_date, 1, 7) = ?`);
          params.push(toMonthKey(now));
          groupBy = dateExpression;
          break;
        case "current_week": {
          const weekStart = getWeekStart(now);
          const weekEnd = addDays(weekStart, 6);
          dateExpression = "substr(activation_date, 1, 10)";
          conditions.push(`substr(activation_date, 1, 10) BETWEEN ? AND ?`);
          params.push(toDateKey(weekStart), toDateKey(weekEnd));
          groupBy = dateExpression;
          break;
        }
        case "last_week": {
          const currentWeekStart = getWeekStart(now);
          const lastWeekStart = addDays(currentWeekStart, -7);
          const lastWeekEnd = addDays(lastWeekStart, 6);
          dateExpression = "substr(activation_date, 1, 10)";
          conditions.push(`substr(activation_date, 1, 10) BETWEEN ? AND ?`);
          params.push(toDateKey(lastWeekStart), toDateKey(lastWeekEnd));
          groupBy = dateExpression;
          break;
        }
        case "90d": {
          const fromDate = addDays(now, -89);
          dateExpression = "substr(activation_date, 1, 10)";
          conditions.push(`substr(activation_date, 1, 10) BETWEEN ? AND ?`);
          params.push(toDateKey(fromDate), toDateKey(now));
          groupBy = dateExpression;
          break;
        }
      }
    }

    // Add custom date range conditions
    if (date_range?.from && date_range?.to) {
      // Validate that from date is not after to date
      if (date_range.from > date_range.to) {
        return NextResponse.json(
          {
            success: false,
            error: "From date cannot be after to date",
          },
          { status: 400 }
        );
      }

      dateExpression = "substr(activation_date, 1, 10)";
      conditions.push(`substr(activation_date, 1, 10) BETWEEN ? AND ?`);
      params.push(date_range.from, date_range.to);
      groupBy = dateExpression;
    }

    // Build query for all contracts (not filtered by user)
    let query = `
      SELECT
        ${dateExpression} as date,
        COUNT(CASE WHEN status = 'Activo' THEN 1 ELSE NULL END) as active,
        COUNT(CASE WHEN status = 'Baja' THEN 1 ELSE NULL END) as baja,
        COALESCE(SUM(comision), 0) as comision,
        COALESCE(SUM(comision_sales_person), 0) as comision_sales_person
      FROM tramites
      WHERE status IN ('Activo', 'Baja')`;

    // Apply conditions to query
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(" AND ")}`;
    }

    // Add grouping and ordering
    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
    }
    query += ` ORDER BY date`;

    // Execute query
    const rs = await executeReadWithRetry(tursoClient, {
      sql: query,
      args: params,
    });

    // Process results based on time range
    const results = new Map<string, Omit<ContractAnalyticsData, "field">>();

    // Initialize results structure based on time range
    initializeResultsStructure(results, time_range, date_range);

    // Populate results with query data
    populateResults(results, rs.rows, time_range, date_range);

    // Convert to response format
    const data: ContractAnalyticsData[] = Array.from(results.entries()).map(
      ([field, values]) => ({
        field,
        active: values.active,
        baja: values.baja, // Note: in monthly-active-pending, baja values were negated
        comision: values.comision,
        comision_sales_person: values.comision_sales_person,
      })
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (isRetryableLibsqlError(error)) {
      console.warn("Turso unavailable fetching monthly contract analytics:", error);
      return databaseUnavailableResponse();
    }

    console.error("Error fetching monthly contract analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching monthly contract analytics",
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
  dateRange?: DateRange | { from?: string; to?: string }
): void {
  const defaultData = {
    active: 0,
    baja: 0,
    comision: 0,
    comision_sales_person: 0,
  };

  if (timeRange === "current_week" || timeRange === "last_week") {
    const currentWeekStart = getWeekStart(new Date());
    const weekStart =
      timeRange === "current_week"
        ? currentWeekStart
        : addDays(currentWeekStart, -7);

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayStr = day.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      results.set(dayStr, { ...defaultData });
    }
  } else if (timeRange === "current_month") {
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        i
      );
      const dayStr = currentDate.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      results.set(dayStr, { ...defaultData });
    }
  } else if (timeRange === "year") {
    MONTH_NAMES.forEach((month) => results.set(month, { ...defaultData }));
  } else if (timeRange === "90d") {
    for (let i = 89; i >= 0; i--) {
      const date = addDays(new Date(), -i);
      const dayStr = date.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      results.set(dayStr, { ...defaultData });
    }
  } else if (dateRange?.from && dateRange?.to) {
    const fromDate =
      dateRange.from instanceof Date
        ? dateRange.from
        : new Date(`${dateRange.from}T00:00:00`);
    const toDate =
      dateRange.to instanceof Date
        ? dateRange.to
        : new Date(`${dateRange.to}T00:00:00`);

    for (
      let date = new Date(fromDate);
      date <= toDate;
      date.setDate(date.getDate() + 1)
    ) {
      const dateStr = date.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
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
  dateRange?: DateRange | { from?: string; to?: string }
): void {
  rows.forEach((row) => {
    const dateKey = row.date as string;
    let key: string;

    if (timeRange === "current_week" || timeRange === "last_week") {
      key = getDateLabel(dateKey);
    } else if (timeRange === "current_month") {
      key = getDateLabel(dateKey);
    } else if (timeRange === "year") {
      key = getMonthLabel(dateKey);
    } else if (timeRange === "90d" || (dateRange?.from && dateRange?.to)) {
      key = getDateLabel(dateKey);
    } else {
      key = dateKey;
    }

    if (results.has(key)) {
      results.set(key, {
        active: Number(row.active || 0),
        baja: -Math.abs(Number(row.baja || 0)), // Convert to negative value as in original
        comision: Number(row.comision || 0),
        comision_sales_person: Number(row.comision_sales_person || 0),
      });
    }
  });
}
