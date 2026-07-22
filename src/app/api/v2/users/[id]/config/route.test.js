import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(() => ({ rows: [], rowsAffected: 1 })),
  getTursoClient: vi.fn(),
  hashPassword: vi.fn(async () => "hashed-password"),
  sessionResult: {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  },
}));

// batch delega en execute para que las aserciones sobre el SQL emitido sigan
// viendo cada sentencia por separado.
mocks.batch = vi.fn(async (statements) =>
  statements.map((statement) => mocks.execute(statement)),
);

mocks.getTursoClient.mockImplementation(() => ({
  execute: mocks.execute,
  batch: mocks.batch,
}));

vi.mock(import("@/core/libsql/client"), () => ({ getTursoClient: mocks.getTursoClient }));
vi.mock(import("@/core/auth/auth-utils"), () => ({ hashPassword: mocks.hashPassword }));
vi.mock(import("@/core/auth/session-utils"), () => ({
  validateUserSession: () => mocks.sessionResult,
}));
vi.mock("/src/core/libsql/client.ts", () => ({ getTursoClient: mocks.getTursoClient }));
vi.mock("/src/core/auth/auth-utils.ts", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("/src/core/auth/session-utils.ts", () => ({
  validateUserSession: () => mocks.sessionResult,
}));

const configRoute = await import("./route.ts");

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.batch.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.hashPassword.mockClear();
  mocks.sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
});

describe("GET /users/[id]/config", () => {
  test("returns company commissions and targeted notes", async () => {
    mocks.execute.mockImplementation(({ sql }) => {
      if (sql.includes("default_company_commissions")) {
        return {
          rows: [
            {
              id: "d1",
              comercializadora_id: "e2",
              comercializadora_name: "Energia Dos",
              commission_type: "percent",
              commission_value: 10,
              created_at: "2026-01-01",
              updated_at: "2026-01-02",
            },
          ],
          rowsAffected: 0,
        };
      }
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
    expect(body.data.default_commissions).toHaveLength(1);
    expect(body.data.targeted_notes).toHaveLength(1);
  });

  test("resolves inherited commissions for suppliers without an override", async () => {
    mocks.execute.mockImplementation(({ sql }) => {
      if (sql.includes("default_company_commissions")) {
        return {
          rows: [
            {
              id: "d1",
              comercializadora_id: "e1",
              comercializadora_name: "Energia Uno",
              commission_type: "percent",
              commission_value: 10,
              created_at: null,
              updated_at: null,
            },
            {
              id: "d2",
              comercializadora_id: "e2",
              comercializadora_name: "Energia Dos",
              commission_type: "fixed",
              commission_value: 30,
              created_at: null,
              updated_at: null,
            },
          ],
          rowsAffected: 0,
        };
      }
      if (sql.includes("user_company_commissions")) {
        return {
          rows: [
            {
              id: "c1",
              user_id: "u1",
              comercializadora_id: "e1",
              comercializadora_name: "Energia Uno",
              commission_type: "percent",
              commission_value: 20,
              created_at: null,
              updated_at: null,
            },
          ],
          rowsAffected: 0,
        };
      }
      return { rows: [], rowsAffected: 0 };
    });

    const res = await configRoute.GET(
      new Request("https://x/api/v2/users/u1/config"),
      { params: Promise.resolve({ id: "u1" }) },
    );

    const body = await res.json();
    const effective = body.data.effective_commissions;

    expect(effective).toHaveLength(2);
    // El override del colaborador gana sobre el valor por defecto.
    expect(effective.find((c) => c.comercializadora_id === "e1")).toMatchObject({
      commission_value: 20,
      source: "user",
    });
    // La comercializadora sin override hereda el valor de la asesoría.
    expect(effective.find((c) => c.comercializadora_id === "e2")).toMatchObject({
      commission_value: 30,
      commission_type: "fixed",
      source: "default",
    });
  });
});

describe("PATCH /users/[id]/config", () => {
  test("updates profile, password, commissions, and notes", async () => {
    mocks.execute.mockImplementation(({ sql }) => {
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
    expect(mocks.hashPassword).toHaveBeenCalledWith("secret");
    expect(mocks.execute.mock.calls.some(([arg]) => arg.sql.includes("UPDATE user SET"))).toBe(true);
    expect(mocks.execute.mock.calls.some(([arg]) => arg.sql.includes("UPDATE account"))).toBe(true);
    expect(
      mocks.execute.mock.calls.some(([arg]) =>
        arg.sql.includes("DELETE FROM user_company_commissions"),
      ),
    ).toBe(true);
    expect(
      mocks.execute.mock.calls.some(([arg]) =>
        arg.sql.includes("INSERT INTO user_company_commissions"),
      ),
    ).toBe(true);
    expect(
      mocks.execute.mock.calls.some(([arg]) => arg.sql.includes("UPDATE user_default_notes")),
    ).toBe(true);
    expect(
      mocks.execute.mock.calls.some(([arg]) => arg.sql.includes("INSERT INTO user_default_notes")),
    ).toBe(true);
    expect(
      mocks.execute.mock.calls.some(([arg]) => arg.sql.includes("DELETE FROM user_default_notes")),
    ).toBe(true);
  });

  test("rejects unauthenticated requests", async () => {
    mocks.sessionResult = { success: false };
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
    mocks.execute.mockImplementation(({ sql }) => {
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
