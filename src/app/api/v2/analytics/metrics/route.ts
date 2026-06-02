import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import type { Client } from "@libsql/client";

export async function GET(req: NextRequest) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const client = getTursoClient(req) as Client;
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year") || new Date().getFullYear().toString();

  const now = new Date();
  const currentMonth = month || String(now.getMonth() + 1).padStart(2, "0");

  async function runQuery(sql: string, args: (string | number)[] = []) {
    const result = await client.execute({ sql, args });
    return result.rows;
  }

  const [totalComp, processedComp] = await Promise.all([
    runQuery(
      `SELECT COUNT(*) as total FROM comparativas WHERE substr(creation_date, 1, 7) <= ?`,
      [`${year}-${currentMonth}`],
    ),
    runQuery(
      `SELECT COUNT(*) as total FROM comparativas WHERE status = 'processed' AND substr(creation_date, 1, 7) <= ?`,
      [`${year}-${currentMonth}`],
    ),
  ]);
  const totalComparativas = Number(totalComp[0]?.total ?? 0);
  const processedComparativas = Number(processedComp[0]?.total ?? 0);
  const conversionRatio = totalComparativas > 0 ? processedComparativas / totalComparativas : 0;

  const avgResult = await runQuery(
    `SELECT AVG(comision) as avg FROM tramites WHERE status = 'Activo' AND substr(activation_date, 1, 7) <= ?`,
    [`${year}-${currentMonth}`],
  );
  const ticketMedio = Number(avgResult[0]?.avg ?? 0);

  const avgPaidResult = await runQuery(
    `SELECT AVG(comision_sales_person) as avg FROM tramites WHERE status = 'Activo' AND substr(activation_date, 1, 7) <= ?`,
    [`${year}-${currentMonth}`],
  );
  const comisionMediaPagada = Number(avgPaidResult[0]?.avg ?? 0);

  const [totalActive, renewedActive] = await Promise.all([
    runQuery(
      `SELECT COUNT(*) as total FROM tramites WHERE status = 'Activo' AND substr(activation_date, 1, 7) <= ?`,
      [`${year}-${currentMonth}`],
    ),
    runQuery(
      `SELECT COUNT(*) as total FROM tramites WHERE status = 'Activo' AND renewal_count > 0 AND substr(activation_date, 1, 7) <= ?`,
      [`${year}-${currentMonth}`],
    ),
  ]);
  const totalActiveTramites = Number(totalActive[0]?.total ?? 0);
  const renewedTramites = Number(renewedActive[0]?.total ?? 0);
  const renewalRatio = totalActiveTramites > 0 ? renewedTramites / totalActiveTramites : 0;

  const renewalByTariff = await runQuery(
    `SELECT con.plan as tariff, COUNT(*) as count FROM tramites t JOIN contracts con ON t.id = con.tramite_id WHERE t.status = 'Activo' AND t.renewal_count > 0 AND substr(t.activation_date, 1, 7) <= ? GROUP BY con.plan`,
    [`${year}-${currentMonth}`],
  );
  const renewalByTariffMap: Record<string, number> = {};
  for (const row of renewalByTariff) {
    renewalByTariffMap[String(row.tariff)] = Number(row.count);
  }

  return NextResponse.json({
    success: true,
    data: {
      conversionRatio,
      ticketMedio,
      comisionMediaPagada,
      renewalRatio,
      renewalByTariff: renewalByTariffMap,
    },
  });
}
