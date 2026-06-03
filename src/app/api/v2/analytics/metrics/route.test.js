import { beforeEach, describe, expect, mock, test } from "bun:test";

let executeImpl;
const execute = mock((statement) => executeImpl(statement));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));

mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const metricsRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
  executeImpl = async (stmt) => {
    const sql = stmt.sql || stmt;
    if (sql.includes("GROUP BY substr(activation_date")) {
      return {
        rows: [
          { field: "2026-01", ticketMedio: 100, comisionMediaPagada: 25 },
        ],
        rowsAffected: 0,
      };
    }
    if (sql.includes("GROUP BY con.plan")) {
      return { rows: [{ tariff: "Fijo", count: 3 }], rowsAffected: 0 };
    }
    if (sql.includes("COUNT")) {
      return { rows: [{ total: 10 }], rowsAffected: 0 };
    }
    if (sql.includes("comision_sales_person")) {
      return { rows: [{ avg: 25 }], rowsAffected: 0 };
    }
    if (sql.includes("comision")) {
      return { rows: [{ avg: 100 }], rowsAffected: 0 };
    }
    return { rows: [], rowsAffected: 0 };
  };
});

describe("GET /api/v2/analytics/metrics", () => {
  test("returns 401 for unauthenticated requests", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { GET: freshGET } = await import("./route.ts");
    const res = await freshGET(new Request("https://x/api/v2/analytics/metrics"));
    expect(res.status).toBe(401);
  });

  test("returns metrics for non-admin users scoped by user", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({
        success: true,
        user: { id: "c1", role: "2", email: "c@b.com", name: "Comercial" },
      }),
    }));
    const { GET: freshGET } = await import("./route.ts");
    const res = await freshGET(
      new Request("https://x/api/v2/analytics/metrics?id=c1&role=2"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(
      execute.mock.calls.some(([stmt]) => stmt.sql.includes("user_id = ?")),
    ).toBe(true);
  });

  test("returns metrics data for admin", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({
        success: true,
        user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
      }),
    }));
    const { GET: freshGET } = await import("./route.ts");
    const res = await freshGET(
      new Request("https://x/api/v2/analytics/metrics?role=admin&id=admin1"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.ticketComisionSeries).toEqual([
      { field: "2026-01", ticketMedio: 100, comisionMediaPagada: 25 },
    ]);
    expect(body.data.renewalByTariffSeries).toEqual([
      { tariff: "Fijo", count: 3 },
    ]);
  });

  test("uses date range params when provided", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({
        success: true,
        user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
      }),
    }));
    const { GET: freshGET } = await import("./route.ts");
    const res = await freshGET(
      new Request(
        "https://x/api/v2/analytics/metrics?date_from=2026-01-01&date_to=2026-06-02",
      ),
    );
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(execute.mock.calls[0][0].sql).toContain(
      "date(substr(creation_date, 1, 10)) BETWEEN date(?) AND date(?)",
    );
    expect(execute.mock.calls[0][0].args).toEqual([
      "2026-01-01",
      "2026-06-02",
    ]);
  });

  test("uses time range and commercial filters when provided", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({
        success: true,
        user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
      }),
    }));
    const { GET: freshGET } = await import("./route.ts");
    const res = await freshGET(
      new Request(
        "https://x/api/v2/analytics/metrics?id=admin1&role=admin&time_range=year&commercialId=c1",
      ),
    );
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(execute.mock.calls[0][0].sql).toContain(
      "substr(creation_date, 1, 4) = ?",
    );
    expect(execute.mock.calls[0][0].sql).toContain("user_id = ?");
    expect(execute.mock.calls[0][0].args).toContain("c1");
  });
});
