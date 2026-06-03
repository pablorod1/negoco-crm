import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 1 }));
const getTursoClient = mock(() => ({ execute }));
const hashPassword = mock(async () => "hashed-password");
let sessionResult = {
  success: true,
  user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
};

mock.module("@/core/libsql/client", () => ({ getTursoClient }));
mock.module("@/core/auth/auth-utils", () => ({ hashPassword }));
mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => sessionResult,
}));

const configRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
  hashPassword.mockClear();
  sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
});

describe("GET /users/[id]/config", () => {
  test("returns company commissions and targeted notes", async () => {
    execute.mockImplementation(({ sql }) => {
      if (sql.includes("user_company_commissions")) {
        return {
          rows: [
            {
              id: "c1",
              user_id: "u1",
              comercializadora_id: "e1",
              comercializadora_name: "Energia Uno",
              commission_type: "percent",
              commission_value: 12.5,
              created_at: "2026-01-01",
              updated_at: "2026-01-02",
            },
          ],
          rowsAffected: 0,
        };
      }
      return {
        rows: [
          {
            id: "n1",
            user_id: "u1",
            target: "tramites",
            note: "Nota",
            created_at: "2026-01-01",
            updated_at: "2026-01-02",
          },
        ],
        rowsAffected: 0,
      };
    });

    const res = await configRoute.GET(
      new Request("https://x/api/v2/users/u1/config"),
      { params: Promise.resolve({ id: "u1" }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.company_commissions).toHaveLength(1);
    expect(body.data.targeted_notes).toHaveLength(1);
  });
});

describe("PATCH /users/[id]/config", () => {
  test("updates profile, password, commissions, and notes", async () => {
    execute.mockImplementation(({ sql }) => {
      if (sql.includes("SELECT id FROM user")) {
        return { rows: [{ id: "u1" }], rowsAffected: 0 };
      }
      if (sql.includes("UPDATE account")) {
        return { rows: [], rowsAffected: 1 };
      }
      return { rows: [], rowsAffected: 1 };
    });

    const res = await configRoute.PATCH(
      new Request("https://x/api/v2/users/u1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name: "User One",
            email: "user@example.com",
            super_id: null,
            password: "secret",
          },
          company_commissions: [
            {
              comercializadora_id: "e1",
              commission_type: "fixed",
              commission_value: 25,
            },
          ],
          targeted_notes: [
            { id: "n1", target: "global", note: "Actualizada" },
            { target: "comparativas", note: "Nueva" },
            { id: "n2", target: "tramites", note: "", delete: true },
          ],
        }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith("secret");
    expect(execute.mock.calls.some(([arg]) => arg.sql.includes("UPDATE user SET"))).toBe(true);
    expect(execute.mock.calls.some(([arg]) => arg.sql.includes("UPDATE account"))).toBe(true);
    expect(
      execute.mock.calls.some(([arg]) =>
        arg.sql.includes("DELETE FROM user_company_commissions"),
      ),
    ).toBe(true);
    expect(
      execute.mock.calls.some(([arg]) =>
        arg.sql.includes("INSERT INTO user_company_commissions"),
      ),
    ).toBe(true);
    expect(
      execute.mock.calls.some(([arg]) => arg.sql.includes("UPDATE user_default_notes")),
    ).toBe(true);
    expect(
      execute.mock.calls.some(([arg]) => arg.sql.includes("INSERT INTO user_default_notes")),
    ).toBe(true);
    expect(
      execute.mock.calls.some(([arg]) => arg.sql.includes("DELETE FROM user_default_notes")),
    ).toBe(true);
  });

  test("rejects unauthenticated requests", async () => {
    sessionResult = { success: false };
    const res = await configRoute.PATCH(
      new Request("https://x/api/v2/users/u1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_commissions: [] }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );
    expect(res.status).toBe(401);
  });

  test("returns an error when password account is missing", async () => {
    execute.mockImplementation(({ sql }) => {
      if (sql.includes("SELECT id FROM user")) {
        return { rows: [{ id: "u1" }], rowsAffected: 0 };
      }
      if (sql.includes("UPDATE account")) {
        return { rows: [], rowsAffected: 0 };
      }
      return { rows: [], rowsAffected: 1 };
    });

    const res = await configRoute.PATCH(
      new Request("https://x/api/v2/users/u1/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { password: "secret" } }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
