import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  createComparativaChange: vi.fn(),
  deleteFolderFromStorage: vi.fn(),
  execute: vi.fn(),
  getSubcomerciales: vi.fn(),
  getTursoClient: vi.fn(),
  rollback: vi.fn(),
  transaction: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));
vi.mock("@/comparativas/utils/comparativaChangesHelpers", () => ({
  createComparativaChange: mocks.createComparativaChange,
}));
vi.mock("@/core/firebase/data/deleteFolder", () => ({
  deleteFolderFromStorage: mocks.deleteFolderFromStorage,
}));
vi.mock("@/comparativas/utils/abarca-apolo-sips", () => ({
  parseAbarcaApoloSipsSummary: vi.fn(),
}));

const route = await import("./route");

const authenticatedUser = {
  id: "user-1",
  role: "1",
  email: "user@example.com",
  name: "User",
};

const comparisonRow = {
  id: "comparison-1",
  client: "Old client",
  service: "Luz",
  plan: JSON.stringify(["fijo"]),
  status: "pending",
  comision_fijo: 10,
  comision_indexado: 20,
  comision_sales_person_fijo: 5,
  comision_sales_person_indexado: 10,
  notes: JSON.stringify(["Old note"]),
  creation_date: "2026-01-01T00:00:00.000Z",
  tramite_id: null,
  company_id: null,
  has_permanencia: 0,
  has_renovacion: 0,
  user_id: "user-1",
  email: "owner@example.com",
  name: "Owner",
  image: null,
};

let comparisonVisible: boolean;
let comparisonStatus: string;
let storedComparisonRow: typeof comparisonRow;
let updateRowsAffected: number;

const transaction = {
  execute: mocks.execute,
  commit: mocks.commit,
  rollback: mocks.rollback,
};

const storedPatchColumns = [
  "client",
  "service",
  "plan",
  "notes",
] as const;

const planUpdateAudit = {
  change_type: "plan_update",
  field_name: "plan",
  old_value: JSON.stringify(["fijo"]),
  new_value: JSON.stringify(["fijo", "indexado"]),
  description: "Plan actualizado de [fijo] a [fijo, indexado]",
};

function applyStoredComparisonUpdate(statement: {
  sql: string;
  args: unknown[];
}) {
  let updateArgumentIndex = 0;

  for (const column of storedPatchColumns) {
    if (statement.sql.includes(`${column} = ?`)) {
      Object.assign(storedComparisonRow, {
        [column]: String(statement.args[updateArgumentIndex]),
      });
      updateArgumentIndex += 1;
    }
  }
}

function expectAuditChanges(...changes: Array<Record<string, string>>) {
  expect(mocks.createComparativaChange.mock.calls).toEqual(
    changes.map((change) => [
      transaction,
      {
        comparativa_id: "comparison-1",
        user_id: "user-1",
        ...change,
      },
    ]),
  );
}

function request(body: unknown) {
  return new NextRequest(
    "https://tenant.example.com/api/v2/comparisons/comparison-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function patch(body: unknown, comparisonId = "comparison-1") {
  return route.PATCH(request(body), {
    params: Promise.resolve({ id: comparisonId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  comparisonVisible = true;
  comparisonStatus = "pending";
  storedComparisonRow = { ...comparisonRow };
  updateRowsAffected = 1;

  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: authenticatedUser,
  });
  mocks.getTursoClient.mockReturnValue({
    execute: mocks.execute,
    transaction: mocks.transaction,
  });
  mocks.transaction.mockResolvedValue(transaction);
  mocks.commit.mockResolvedValue(undefined);
  mocks.rollback.mockResolvedValue(undefined);
  mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
  mocks.createComparativaChange.mockResolvedValue(true);
  mocks.execute.mockImplementation(
    async (statement: { sql: string; args: unknown[] }) => {
      if (statement.sql.includes("FROM comparativas c")) {
        return {
          rows: comparisonVisible
            ? [{ ...storedComparisonRow, status: comparisonStatus }]
            : [],
        };
      }
      if (statement.sql.includes("FROM comparativa_files")) {
        return { rows: [] };
      }
      if (
        statement.sql.trimStart().startsWith("UPDATE comparativas")
      ) {
        if (updateRowsAffected > 0) {
          applyStoredComparisonUpdate(statement);
        }
        return { rows: [], rowsAffected: updateRowsAffected };
      }
      throw new Error(`Unexpected SQL in test: ${statement.sql}`);
    },
  );
});

describe("PATCH /api/v2/comparisons/[id]", () => {
  test("returns 401 before parsing the body or opening the database", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await patch({ client: "New client" });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test.each([
    { status: "completed" },
    { tramite_id: "tramite-1" },
    { comisions: { comision_fijo: 99 } },
    { user_id: "attacker-user" },
    { client: "New client", status: "completed" },
  ])("rejects sensitive PATCH keys without writing", async (body) => {
    const response = await patch(body);

    expect(response.status).toBe(400);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
  });

  test("rejects user_id spoofing before database access", async () => {
    const response = await patch({
      client: "New client",
      user_id: "spoofed-user",
    });

    expect(response.status).toBe(400);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
  });

  test.each([
    { name: "an empty plan", plan: [] },
    { name: "duplicate plans", plan: ["fijo", "fijo"] },
    { name: "an invalid plan", plan: ["variable"] },
  ])("rejects $name before database access", async ({ plan }) => {
    const response = await patch({ plan });

    expect(response.status).toBe(400);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
  });

  test.each(["admin", "1"])(
    "allows a completed plan update for role %s",
    async (role) => {
      comparisonStatus = "completed";
      mocks.validateUserSession.mockResolvedValue({
        success: true,
        user: { ...authenticatedUser, role },
      });

      const response = await patch({ plan: ["fijo", "indexado"] });

      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.plan).toEqual(["fijo", "indexado"]);
      expect(mocks.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("UPDATE comparativas"),
          args: [JSON.stringify(["fijo", "indexado"]), "comparison-1"],
        }),
      );
      const updateStatement = mocks.execute.mock.calls.find(
        ([statement]) =>
          (statement as { sql: string }).sql
            .trimStart()
            .startsWith("UPDATE comparativas"),
      )?.[0] as { sql: string } | undefined;
      expect(updateStatement?.sql).not.toContain("comision_");
      expectAuditChanges(planUpdateAudit);
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      expect(mocks.rollback).not.toHaveBeenCalled();
    },
  );

  test("commits a completed mixed update and all audits atomically", async () => {
    comparisonStatus = "completed";
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { ...authenticatedUser, role: "admin" },
    });

    const response = await patch({
      client: "New client",
      service: "Gas",
      plan: ["fijo", "indexado"],
      notes: ["New note"],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        client: "New client",
        service: "Gas",
        plan: ["fijo", "indexado"],
        notes: ["New note"],
      },
    });
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("UPDATE comparativas"),
        args: [
          "New client",
          "Gas",
          JSON.stringify(["fijo", "indexado"]),
          JSON.stringify(["New note"]),
          "comparison-1",
        ],
      }),
    );
    expectAuditChanges(
      {
        change_type: "client_update",
        field_name: "client",
        old_value: "Old client",
        new_value: "New client",
        description:
          'Cliente actualizado de "Old client" a "New client"',
      },
      {
        change_type: "service_update",
        field_name: "service",
        old_value: "Luz",
        new_value: "Gas",
        description: 'Servicio actualizado de "Luz" a "Gas"',
      },
      planUpdateAudit,
      {
        change_type: "general_update",
        field_name: "notes",
        old_value: JSON.stringify(["Old note"]),
        new_value: JSON.stringify(["New note"]),
        description: "Notas actualizadas",
      },
    );
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "role 2 plan update",
      role: "2",
      body: { plan: ["fijo", "indexado"] },
    },
    {
      name: "role 2 mixed update",
      role: "2",
      body: {
        client: "New client",
        plan: ["fijo", "indexado"],
        notes: ["New note"],
      },
    },
    {
      name: "unsupported role plan update",
      role: "3",
      body: { plan: ["fijo", "indexado"] },
    },
  ])("rejects a $name before database access", async ({ role, body }) => {
    comparisonStatus = "completed";
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { ...authenticatedUser, role },
    });

    const response = await patch(body);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: "Forbidden",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
  });

  test.each([
    "pending",
    "awaiting_review",
    "processed",
    "rejected",
    "rechazado_cliente",
  ])("rejects a plan update when status is %s", async (status) => {
    comparisonStatus = status;

    const response = await patch({ plan: ["fijo", "indexado"] });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: "Comparison status changed",
    });
    expect(mocks.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("UPDATE comparativas"),
      }),
    );
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("rejects a mixed update atomically when status is not completed", async () => {
    comparisonStatus = "pending";

    const response = await patch({
      client: "New client",
      plan: ["fijo", "indexado"],
      notes: ["New note"],
    });

    expect(response.status).toBe(409);
    expect(mocks.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("UPDATE comparativas"),
      }),
    );
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("returns 404 when an authorized plan update cannot find the comparison", async () => {
    comparisonVisible = false;

    const response = await patch({ plan: ["fijo", "indexado"] });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "Comparativa not found",
    });
    expect(mocks.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("UPDATE comparativas"),
      }),
    );
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("returns 404 for a role 2 user outside the commercial hierarchy", async () => {
    comparisonVisible = false;
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        ...authenticatedUser,
        id: "commercial-1",
        role: "2",
      },
    });
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["subordinate-1"],
    });

    const response = await patch({ notes: ["New note"] });

    expect(response.status).toBe(404);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [
          "comparison-1",
          "commercial-1",
          "subordinate-1",
        ],
        sql: expect.stringContaining("AND u.id IN (?, ?)"),
      }),
    );
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "pending own comparison",
      status: "pending",
      subordinateIds: [],
      expectedArgs: ["comparison-1", "commercial-1"],
    },
    {
      name: "pending subordinate comparison",
      status: "pending",
      subordinateIds: ["subordinate-1"],
      expectedArgs: [
        "comparison-1",
        "commercial-1",
        "subordinate-1",
      ],
    },
    {
      name: "completed own comparison",
      status: "completed",
      subordinateIds: [],
      expectedArgs: ["comparison-1", "commercial-1"],
    },
  ])(
    "allows metadata updates for a role 2 $name",
    async ({ status, subordinateIds, expectedArgs }) => {
      comparisonStatus = status;
      mocks.validateUserSession.mockResolvedValue({
        success: true,
        user: {
          ...authenticatedUser,
          id: "commercial-1",
          role: "2",
        },
      });
      mocks.getSubcomerciales.mockResolvedValue({
        success: true,
        ids: subordinateIds,
      });

      const response = await patch({
        client: "New client",
        service: "Gas",
        notes: ["New note"],
      });

      expect(response.status).toBe(200);
      const comparisonQueries = mocks.execute.mock.calls.filter(
        ([statement]) =>
          (statement as { sql: string }).sql.includes(
            "FROM comparativas c",
          ),
      );
      expect(comparisonQueries).toHaveLength(2);
      for (const [statement] of comparisonQueries) {
        expect(statement).toEqual(
          expect.objectContaining({ args: expectedArgs }),
        );
      }
      expect(mocks.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining("UPDATE comparativas"),
          args: [
            "New client",
            "Gas",
            JSON.stringify(["New note"]),
            ...expectedArgs,
          ],
        }),
      );
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      expect(mocks.rollback).not.toHaveBeenCalled();
    },
  );

  test("records metadata audits with the authenticated session user", async () => {
    const response = await patch({ client: "New client" });

    expect(response.status).toBe(200);
    expect(mocks.createComparativaChange).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        comparativa_id: "comparison-1",
        user_id: "user-1",
        change_type: "client_update",
        field_name: "client",
      }),
    );
  });

  test.each([
    "comparison 1",
    "../comparison-1",
    "a".repeat(129),
  ])("rejects an unsafe comparison path before database access", async (id) => {
    const response = await patch({ client: "New client" }, id);

    expect(response.status).toBe(400);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("returns a generic 500 when the database client is unavailable", async () => {
    mocks.getTursoClient.mockReturnValue(null);

    const response = await patch({ client: "New client" });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Internal server error",
    });
  });

  test("rolls back when ownership changes before the scoped update", async () => {
    updateRowsAffected = 0;
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        ...authenticatedUser,
        id: "commercial-1",
        role: "2",
      },
    });
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["subordinate-1"],
    });

    const response = await patch({ client: "New client" });

    expect(response.status).toBe(404);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("AND user_id IN (?, ?)"),
        args: [
          "New client",
          "comparison-1",
          "commercial-1",
          "subordinate-1",
        ],
      }),
    );
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("rolls back the metadata update when auditing fails", async () => {
    mocks.createComparativaChange.mockResolvedValue(false);

    const response = await patch({ client: "New client" });

    expect(response.status).toBe(500);
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("UPDATE comparativas"),
      }),
    );
    expect(mocks.createComparativaChange).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ user_id: "user-1" }),
    );
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });
});
