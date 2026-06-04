import { beforeEach, describe, expect, test, vi } from "vitest";

const adminSession = {
  success: true,
  user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
};

const mocks = vi.hoisted(() => ({
  executeImpl: undefined,
  execute: vi.fn((statement) => mocks.executeImpl(statement)),
  getTursoClient: vi.fn(),
  getSubcomerciales: vi.fn(async () => ({ success: true, ids: [] })),
  sessionResult: {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  },
}));

mocks.getTursoClient.mockImplementation(() => ({ execute: mocks.execute }));

vi.mock("@/core/libsql/client", () => ({ getTursoClient: mocks.getTursoClient }));
vi.mock("/src/core/libsql/client.ts", () => ({ getTursoClient: mocks.getTursoClient }));
vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));
vi.mock("/src/core/libsql/users/getSubcomerciales.ts", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: () => mocks.sessionResult,
}));
vi.mock("/src/core/auth/session-utils.ts", () => ({
  validateUserSession: () => mocks.sessionResult,
}));

const metricsRoute = await import("./route.ts");

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.getSubcomerciales.mockClear();
  mocks.sessionResult = adminSession;
  mocks.executeImpl = async (stmt) => {
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
    if (sql.includes("legacyRenewedContracts")) {
      return {
        rows: [{ renewedContracts: 4, legacyRenewedContracts: 1 }],
        rowsAffected: 0,
      };
    }
    if (sql.includes("con.type <> 'Renovación'")) {
      return { rows: [{ total: 6 }], rowsAffected: 0 };
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
    mocks.sessionResult = { success: false };
    const res = await metricsRoute.GET(new Request("https://x/api/v2/analytics/metrics"));
    expect(res.status).toBe(401);
  });

  test("returns 403 for non-admin users", async () => {
    mocks.sessionResult = {
      success: true,
      user: { id: "c1", role: "2", email: "c@b.com", name: "Comercial" },
    };
    const res = await metricsRoute.GET(
      new Request("https://x/api/v2/analytics/metrics?id=c1&role=2"),
    );

    expect(res.status).toBe(403);
  });

  test("returns metrics data for admin", async () => {
    mocks.sessionResult = adminSession;
    const res = await metricsRoute.GET(
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
    expect(body.data.renewedContracts).toBe(4);
    expect(body.data.pendingRenewableContracts).toBe(6);
    expect(body.data.renewableOpportunityTotal).toBe(10);
    expect(body.data.legacyRenewedContracts).toBe(1);
    expect(body.data.renewalRatio).toBe(0.4);
  });

  test("uses date range params when provided", async () => {
    mocks.sessionResult = adminSession;
    const res = await metricsRoute.GET(
      new Request(
        "https://x/api/v2/analytics/metrics?date_from=2026-01-01&date_to=2026-06-02",
      ),
    );
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(mocks.execute.mock.calls[0][0].sql).toContain(
      "date(substr(creation_date, 1, 10)) BETWEEN date(?) AND date(?)",
    );
    expect(mocks.execute.mock.calls[0][0].args).toEqual([
      "2026-01-01",
      "2026-06-02",
    ]);

    const pendingRenewableCall = mocks.execute.mock.calls.find(([stmt]) =>
      stmt.sql.includes("con.type <> 'Renovación'"),
    );
    expect(pendingRenewableCall[0].args[0]).toBe("2026-08-01");
  });

  test("uses time range and commercial filters when provided", async () => {
    mocks.sessionResult = adminSession;
    const res = await metricsRoute.GET(
      new Request(
        "https://x/api/v2/analytics/metrics?id=admin1&role=admin&time_range=year&commercialId=c1",
      ),
    );
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(mocks.execute.mock.calls[0][0].sql).toContain(
      "substr(creation_date, 1, 4) = ?",
    );
    expect(mocks.execute.mock.calls[0][0].sql).toContain("user_id = ?");
    expect(mocks.execute.mock.calls[0][0].args).toContain("c1");

    const renewalSql = mocks.execute.mock.calls
      .map(([stmt]) => stmt.sql)
      .filter((sql) => sql.includes("Renovación"))
      .join("\n");

    expect(renewalSql).not.toContain("renewal_count");
    expect(renewalSql).toContain("con.type = 'Renovación'");
    expect(renewalSql).toContain(
      "date(substr(t.renovation_date, 1, 10)) <= date(?)",
    );
    expect(renewalSql).toContain("t.user_id = ?");
  });

  test("returns zero renewal ratio when there are no renewable opportunities", async () => {
    mocks.executeImpl = async (stmt) => {
      const sql = stmt.sql || stmt;
      if (sql.includes("GROUP BY substr(activation_date")) {
        return { rows: [], rowsAffected: 0 };
      }
      if (sql.includes("legacyRenewedContracts")) {
        return {
          rows: [{ renewedContracts: 0, legacyRenewedContracts: 0 }],
          rowsAffected: 0,
        };
      }
      if (sql.includes("con.type <> 'Renovación'")) {
        return { rows: [{ total: 0 }], rowsAffected: 0 };
      }
      if (sql.includes("GROUP BY con.plan")) {
        return { rows: [], rowsAffected: 0 };
      }
      if (sql.includes("COUNT")) {
        return { rows: [{ total: 0 }], rowsAffected: 0 };
      }
      if (sql.includes("AVG")) {
        return { rows: [{ avg: 0 }], rowsAffected: 0 };
      }
      return { rows: [], rowsAffected: 0 };
    };

    const res = await metricsRoute.GET(new Request("https://x/api/v2/analytics/metrics"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data.renewedContracts).toBe(0);
    expect(body.data.pendingRenewableContracts).toBe(0);
    expect(body.data.renewableOpportunityTotal).toBe(0);
    expect(body.data.legacyRenewedContracts).toBe(0);
    expect(body.data.renewalRatio).toBe(0);
  });
});
