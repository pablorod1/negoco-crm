import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 1 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));

mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const configRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("PATCH /users/[id]/config", () => {
  test("updates commission_pct and default_notes", async () => {
    const res = await configRoute.PATCH(
      new Request("https://x/api/v2/users/u1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_pct: 15.5, default_notes: "Nota predefinida" }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("rejects unauthenticated requests", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { PATCH: fresh } = await import("./route.ts");
    const res = await fresh(
      new Request("https://x/api/v2/users/u1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_pct: 10 }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(res.status).toBe(401);
  });
});
