import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { z } from "zod";
import type { Client } from "@libsql/client";

const QueryParamsSchema = z.object({
  id: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  commercialId: z.string().optional(),
  time_range: z
    .enum(["year", "current_month", "current_week", "last_week", "90d"])
    .optional(),
  month: z.string().regex(/^\d{1,2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type SubcomercialesResult = { success: boolean; ids?: string[] };

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

const createUserFilter = (
  role: string,
  id: string,
  subcomerciales?: SubcomercialesResult,
  commercialId?: string,
  userColumn = "user_id",
) => {
  const params: string[] = [];
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

const buildDateFilter = ({
  column,
  timeRange,
  month,
  year,
  dateFrom,
  dateTo,
}: {
  column: string;
  timeRange?: z.infer<typeof QueryParamsSchema>["time_range"];
  month?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const now = new Date();
  const currentMonth = month || String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = year || String(now.getFullYear());

  if (dateFrom && dateTo) {
    return {
      condition: `date(substr(${column}, 1, 10)) BETWEEN date(?) AND date(?)`,
      args: [dateFrom, dateTo],
      groupExpression: `substr(${column}, 1, 10)`,
    };
  }

  switch (timeRange) {
    case "current_month":
      return {
        condition: `substr(${column}, 1, 7) = ?`,
        args: [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`],
        groupExpression: `substr(${column}, 1, 10)`,
      };
    case "current_week": {
      const weekStart = getWeekStart(now);
      const weekEnd = addDays(weekStart, 6);
      return {
        condition: `substr(${column}, 1, 10) BETWEEN ? AND ?`,
        args: [toDateKey(weekStart), toDateKey(weekEnd)],
        groupExpression: `substr(${column}, 1, 10)`,
      };
    }
    case "last_week": {
      const currentWeekStart = getWeekStart(now);
      const lastWeekStart = addDays(currentWeekStart, -7);
      const lastWeekEnd = addDays(lastWeekStart, 6);
      return {
        condition: `substr(${column}, 1, 10) BETWEEN ? AND ?`,
        args: [toDateKey(lastWeekStart), toDateKey(lastWeekEnd)],
        groupExpression: `substr(${column}, 1, 10)`,
      };
    }
    case "90d": {
      const fromDate = addDays(now, -89);
      return {
        condition: `substr(${column}, 1, 10) BETWEEN ? AND ?`,
        args: [toDateKey(fromDate), toDateKey(now)],
        groupExpression: `substr(${column}, 1, 10)`,
      };
    }
    case "year":
      return {
        condition: `substr(${column}, 1, 4) = ?`,
        args: [String(now.getFullYear())],
        groupExpression: `substr(${column}, 1, 7)`,
      };
    default:
      return {
        condition: `substr(${column}, 1, 7) <= ?`,
        args: [`${currentYear}-${currentMonth}`],
        groupExpression: `substr(${column}, 1, 7)`,
      };
  }
};

export async function GET(req: NextRequest) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const client = getTursoClient(req) as Client;
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams);
  const parsedParams = QueryParamsSchema.safeParse(queryParams);
  if (
    !parsedParams.success &&
    (url.searchParams.has("date_from") || url.searchParams.has("date_to"))
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid date range" },
      { status: 400 },
    );
  }

  const month = parsedParams.success ? parsedParams.data.month : undefined;
  const year = parsedParams.success ? parsedParams.data.year : undefined;
  const timeRange = parsedParams.success ? parsedParams.data.time_range : undefined;
  const dateFrom = parsedParams.success ? parsedParams.data.date_from : undefined;
  const dateTo = parsedParams.success ? parsedParams.data.date_to : undefined;
  const requestedId = parsedParams.success ? parsedParams.data.id : undefined;
  const role = authResult.user.role;
  const id =
    role === "admin" || role === "1"
      ? requestedId || authResult.user.id
      : authResult.user.id;
  const commercialId = parsedParams.success ? parsedParams.data.commercialId : undefined;

  if (
    (dateFrom && !dateTo) ||
    (!dateFrom && dateTo) ||
    (dateFrom && dateTo && dateFrom > dateTo)
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid date range" },
      { status: 400 },
    );
  }

  try {
    async function runQuery(sql: string, args: (string | number)[] = []) {
      const result = await client.execute({ sql, args });
      return result.rows;
    }

    const subcomerciales =
      role === "2" ? await getSubcomerciales(client, id) : undefined;
    const comparativasUserFilter = createUserFilter(
      role,
      id,
      subcomerciales,
      commercialId,
      "user_id",
    );
    const tramitesUserFilter = createUserFilter(
      role,
      id,
      subcomerciales,
      commercialId,
      "user_id",
    );
    const joinedTramitesUserFilter = createUserFilter(
      role,
      id,
      subcomerciales,
      commercialId,
      "t.user_id",
    );
    const comparativasDateFilter = buildDateFilter({
      column: "creation_date",
      timeRange,
      month,
      year,
      dateFrom,
      dateTo,
    });
    const tramitesDateFilter = buildDateFilter({
      column: "activation_date",
      timeRange,
      month,
      year,
      dateFrom,
      dateTo,
    });
    const joinedTramitesDateFilter = buildDateFilter({
      column: "t.activation_date",
      timeRange,
      month,
      year,
      dateFrom,
      dateTo,
    });
    const comparativasWhere = [
      comparativasDateFilter.condition,
      comparativasUserFilter.filter,
    ].filter(Boolean).join(" AND ");
    const tramitesWhere = [
      "status = 'Activo'",
      tramitesDateFilter.condition,
      tramitesUserFilter.filter,
    ].filter(Boolean).join(" AND ");
    const joinedTramitesWhere = [
      "t.status = 'Activo'",
      "t.renewal_count > 0",
      joinedTramitesDateFilter.condition,
      joinedTramitesUserFilter.filter,
    ].filter(Boolean).join(" AND ");
    const comparativasArgs = [
      ...comparativasDateFilter.args,
      ...comparativasUserFilter.params,
    ];
    const tramitesArgs = [
      ...tramitesDateFilter.args,
      ...tramitesUserFilter.params,
    ];
    const joinedTramitesArgs = [
      ...joinedTramitesDateFilter.args,
      ...joinedTramitesUserFilter.params,
    ];

    const [totalComp, processedComp] = await Promise.all([
      runQuery(
        `SELECT COUNT(*) as total FROM comparativas WHERE ${comparativasWhere}`,
        comparativasArgs,
      ),
      runQuery(
        `SELECT COUNT(*) as total FROM comparativas WHERE status = 'processed' AND ${comparativasWhere}`,
        comparativasArgs,
      ),
    ]);
    const totalComparativas = Number(totalComp[0]?.total ?? 0);
    const processedComparativas = Number(processedComp[0]?.total ?? 0);
    const conversionRatio =
      totalComparativas > 0 ? processedComparativas / totalComparativas : 0;

    const avgResult = await runQuery(
      `SELECT AVG(comision) as avg FROM tramites WHERE ${tramitesWhere}`,
      tramitesArgs,
    );
    const ticketMedio = Number(avgResult[0]?.avg ?? 0);

    const avgPaidResult = await runQuery(
      `SELECT AVG(comision_sales_person) as avg FROM tramites WHERE ${tramitesWhere}`,
      tramitesArgs,
    );
    const comisionMediaPagada = Number(avgPaidResult[0]?.avg ?? 0);

    const ticketComisionRows = await runQuery(
      `SELECT ${tramitesDateFilter.groupExpression} as field, AVG(comision) as ticketMedio, AVG(comision_sales_person) as comisionMediaPagada FROM tramites WHERE ${tramitesWhere} GROUP BY ${tramitesDateFilter.groupExpression} ORDER BY field`,
      tramitesArgs,
    );
    const ticketComisionSeries = ticketComisionRows.map((row) => ({
      field: String(row.field),
      ticketMedio: Number(row.ticketMedio ?? 0),
      comisionMediaPagada: Number(row.comisionMediaPagada ?? 0),
    }));

    const [totalActive, renewedActive] = await Promise.all([
      runQuery(
        `SELECT COUNT(*) as total FROM tramites WHERE ${tramitesWhere}`,
        tramitesArgs,
      ),
      runQuery(
        `SELECT COUNT(*) as total FROM tramites WHERE ${tramitesWhere} AND renewal_count > 0`,
        tramitesArgs,
      ),
    ]);
    const totalActiveTramites = Number(totalActive[0]?.total ?? 0);
    const renewedTramites = Number(renewedActive[0]?.total ?? 0);
    const renewalRatio = totalActiveTramites > 0 ? renewedTramites / totalActiveTramites : 0;

    const renewalByTariff = await runQuery(
      `SELECT con.plan as tariff, COUNT(*) as count FROM tramites t JOIN contracts con ON t.id = con.tramite_id WHERE ${joinedTramitesWhere} GROUP BY con.plan`,
      joinedTramitesArgs,
    );
    const renewalByTariffMap: Record<string, number> = {};
    const renewalByTariffSeries: { tariff: string; count: number }[] = [];
    for (const row of renewalByTariff) {
      const tariff = String(row.tariff);
      const count = Number(row.count);
      renewalByTariffMap[tariff] = count;
      renewalByTariffSeries.push({ tariff, count });
    }

    return NextResponse.json({
      success: true,
      data: {
        conversionRatio,
        ticketMedio,
        comisionMediaPagada,
        ticketComisionSeries,
        renewalRatio,
        renewalByTariff: renewalByTariffMap,
        renewalByTariffSeries,
      },
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
