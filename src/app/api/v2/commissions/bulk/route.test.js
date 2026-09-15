import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(() => ({ rows: [], rowsAffected: 1 })),
  batch: vi.fn(async () => []),
  getTursoClient: vi.fn(),
  sessionResult: {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  },
}));

mocks.getTursoClient.mockImplementation(() => ({
  execute: mocks.execute,
  batch: mocks.batch,
}));

vi.mock(import("@/core/libsql/client"), () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock(import("@/core/auth/session-utils"), () => ({
  validateUserSession: () => mocks.sessionResult,
}));
vi.mock("/src/core/libsql/client.ts", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("/src/core/auth/session-utils.ts", () => ({
  validateUserSession: () => mocks.sessionResult,
}));

const bulkRoute = await import("./route.ts");

const postBulk = (body) =>
  bulkRoute.POST(
    new Request("https://x/api/v2/commissions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

/** Todas las sentencias emitidas a través de batch, aplanadas. */
const batchedStatements = () =>
  mocks.batch.mock.calls.flatMap(([statements]) => statements);

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.batch.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
  mocks.execute.mockImplementation(({ sql, args }) => {
    if (sql.includes("SELECT id FROM user")) {
      // Por defecto todos los ids recibidos son comerciales válidos.
      return { rows: args.map((id) => ({ id })), rowsAffected: 0 };
    }
    return { rows: [], rowsAffected: 1 };
  });
});

describe("POST /commissions/bulk", () => {
  test("upserts one commission per user and supplier", async () => {
    const res = await postBulk({
      user_ids: ["u1", "u2"],
      comercializadora_ids: ["e1", "e2"],
      mode: "overwrite",
      commission_type: "percent",
      commission_value: 15,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.updated_users).toBe(2);

    const statements = batchedStatements();
    expect(statements).toHaveLength(4);
    expect(
      statements.every(
        (statement) =>
          statement.sql.includes("INSERT INTO user_company_commissions") &&
          statement.sql.includes("DO UPDATE SET"),
      ),
    ).toBe(true);
    expect(statements[0].args).toEqual(
      expect.arrayContaining(["u1", "e1", "percent", 15]),
    );
  });

  test("does not overwrite existing commissions in only_missing mode", async () => {
    await postBulk({
      user_ids: ["u1"],
      comercializadora_ids: ["e1"],
      mode: "only_missing",
      commission_type: "percent",
      commission_value: 15,
    });

    expect(batchedStatements()[0].sql).toContain("DO NOTHING");
  });

  test("deletes overrides in inherit mode so users fall back to defaults", async () => {
    const res = await postBulk({
      user_ids: ["u1"],
      comercializadora_ids: ["e1", "e2"],
      mode: "inherit",
    });

    expect(res.status).toBe(200);
    const statements = batchedStatements();
    expect(statements).toHaveLength(2);
    expect(
      statements.every((statement) =>
        statement.sql.includes("DELETE FROM user_company_commissions"),
      ),
    ).toBe(true);
  });

  test("skips users that are not comerciales", async () => {
    mocks.execute.mockImplementation(({ sql }) => {
      if (sql.includes("SELECT id FROM user")) {
        // Solo u1 tiene rol "2".
        return { rows: [{ id: "u1" }], rowsAffected: 0 };
      }
      return { rows: [], rowsAffected: 1 };
    });

    const res = await postBulk({
      user_ids: ["u1", "admin1"],
      comercializadora_ids: ["e1"],
      mode: "overwrite",
      commission_type: "percent",
      commission_value: 15,
    });

    const body = await res.json();
    expect(body.data.updated_users).toBe(1);
    expect(body.data.skipped_users).toBe(1);
    expect(batchedStatements()).toHaveLength(1);
  });

  test("rejects non-admin users", async () => {
    mocks.sessionResult = {
      success: true,
      user: { id: "u1", role: "2", email: "u@b.com", name: "Comercial" },
    };

    const res = await postBulk({
      user_ids: ["u2"],
      comercializadora_ids: ["e1"],
      mode: "overwrite",
      commission_type: "percent",
      commission_value: 15,
    });

    expect(res.status).toBe(403);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  test("requires a value unless the mode is inherit", async () => {
    const res = await postBulk({
      user_ids: ["u1"],
      comercializadora_ids: ["e1"],
      mode: "overwrite",
    });

    expect(res.status).toBe(400);
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
