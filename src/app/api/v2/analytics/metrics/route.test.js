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
    if (sql.includes("COUNT")) return { rows: [{ total: 10 }], rowsAffected: 0 };
    if (sql.includes("renewal_count")) return { rows: [], rowsAffected: 0 };
    if (sql.includes("plan")) return { rows: [], rowsAffected: 0 };
    if (sql.includes("comision")) return { rows: [{ avg: 50 }], rowsAffected: 0 };
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

  test("returns 403 for non-admin users", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({
        success: true,
        user: { id: "c1", role: "2", email: "c@b.com", name: "Comercial" },
      }),
    }));
    const { GET: freshGET } = await import("./route.ts");
    const res = await freshGET(new Request("https://x/api/v2/analytics/metrics"));
    expect(res.status).toBe(403);
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
  });
});
