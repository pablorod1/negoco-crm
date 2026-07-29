import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  execute: vi.fn(),
  getEffectivePermission: vi.fn(),
  getSubcomerciales: vi.fn(),
  getTursoClient: vi.fn(),
  recordCommissionChange: vi.fn(),
  recordConvertedToContract: vi.fn(),
  recordStatusChange: vi.fn(),
  rollback: vi.fn(),
  transaction: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/access-control/server", () => ({
  getEffectivePermission: mocks.getEffectivePermission,
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
  recordCommissionChange: mocks.recordCommissionChange,
  recordConvertedToContract: mocks.recordConvertedToContract,
  recordStatusChange: mocks.recordStatusChange,
}));

const route = await import("./route");

let currentComparison:
  | {
      status: string;
      tramite_id: string | null;
      company_id: string | null;
      plan: string;
      comision_fijo: number | null;
      comision_indexado: number | null;
      comision_sales_person_fijo: number | null;
      comision_sales_person_indexado: number | null;
    }
  | undefined;
let statusRowsAffected: number;
let accessibleTramite: boolean;
let activeSupplier: boolean;

const transaction = {
  execute: mocks.execute,
  commit: mocks.commit,
  rollback: mocks.rollback,
};

function request(
  status: string,
  comissions?: Record<string, number>,
  fields: { tramite_id?: string; company_id?: string } = {},
) {
  return new NextRequest(
    "https://tenant.example.com/api/v2/comparisons/comparison-1/status",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, comissions, ...fields }),
    },
  );
}

function patchRequest(req: NextRequest, comparisonId = "comparison-1") {
  return route.PATCH(req, {
    params: Promise.resolve({ id: comparisonId }),
  });
}

function patch(
  status: string,
  comissions?: Record<string, number>,
  fields?: { tramite_id?: string; company_id?: string },
) {
  return patchRequest(request(status, comissions, fields));
}

beforeEach(() => {
  vi.clearAllMocks();
  currentComparison = {
    status: "awaiting_review",
    tramite_id: null,
    company_id: "supplier-1",
    plan: JSON.stringify(["fijo"]),
    comision_fijo: 10,
    comision_indexado: 20,
    comision_sales_person_fijo: 5,
    comision_sales_person_indexado: 10,
  };
  statusRowsAffected = 1;
  accessibleTramite = true;
  activeSupplier = true;

  mocks.getTursoClient.mockReturnValue({
    execute: mocks.execute,
    transaction: mocks.transaction,
  });
  mocks.transaction.mockResolvedValue(transaction);
  mocks.commit.mockResolvedValue(undefined);
  mocks.rollback.mockResolvedValue(undefined);
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: {
      id: "user-1",
      role: "1",
      email: "user@example.com",
      name: "User",
    },
  });
  mocks.getEffectivePermission.mockResolvedValue(true);
  mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
  mocks.recordCommissionChange.mockResolvedValue(true);
  mocks.recordConvertedToContract.mockResolvedValue(true);
  mocks.recordStatusChange.mockResolvedValue(true);
  mocks.execute.mockImplementation(
    async (statement: { sql: string; args: unknown[] }) => {
      if (
        statement.sql.trimStart().startsWith("SELECT") &&
        statement.sql.includes("comision_sales_person_indexado")
      ) {
        return {
          rows: currentComparison ? [currentComparison] : [],
          rowsAffected: 0,
        };
      }
      if (statement.sql.includes("SELECT id FROM tramites WHERE id = ?")) {
        return {
          rows: accessibleTramite ? [{ id: "tramite-1" }] : [],
          rowsAffected: 0,
        };
      }
      if (statement.sql.includes("FROM comercializadoras")) {
        return {
          rows: activeSupplier ? [{ id: "supplier-1" }] : [],
          rowsAffected: 0,
        };
      }
      if (
        statement.sql
          .trimStart()
          .startsWith("UPDATE comparativas SET status")
      ) {
        return { rows: [], rowsAffected: statusRowsAffected };
      }
      if (statement.sql.includes("UPDATE comparativas SET comision_")) {
        return { rows: [], rowsAffected: 1 };
      }

      throw new Error(`Unexpected SQL in test: ${statement.sql}`);
    },
  );
});

describe("PATCH /api/v2/comparisons/[id]/status", () => {
  test("returns 401 without opening the database", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await patch("completed");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("returns 404 for an authenticated role outside the comparison access model", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "invalid-role-user",
        role: "3",
        email: "invalid@example.com",
        name: "Invalid",
      },
    });

    const response = await patch("completed");

    expect(response.status).toBe(404);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test.each([
    {
      name: "own comparison",
      subordinateIds: [],
      comparison: true,
      expectedStatus: 200,
      expectedArgs: ["comparison-1", "commercial-1"],
    },
    {
      name: "subordinate comparison",
      subordinateIds: ["subordinate-1"],
      comparison: true,
      expectedStatus: 200,
      expectedArgs: [
        "comparison-1",
        "commercial-1",
        "subordinate-1",
      ],
    },
    {
      name: "comparison outside the hierarchy",
      subordinateIds: ["subordinate-1"],
      comparison: false,
      expectedStatus: 404,
      expectedArgs: [
        "comparison-1",
        "commercial-1",
        "subordinate-1",
      ],
    },
  ])(
    "scopes role 2 access for $name",
    async ({
      subordinateIds,
      comparison,
      expectedStatus,
      expectedArgs,
    }) => {
      mocks.validateUserSession.mockResolvedValue({
        success: true,
        user: {
          id: "commercial-1",
          role: "2",
          email: "commercial@example.com",
          name: "Commercial",
        },
      });
      mocks.getSubcomerciales.mockResolvedValue({
        success: true,
        ids: subordinateIds,
      });
      if (!comparison) currentComparison = undefined;

      const response = await patch("completed");

      expect(response.status).toBe(expectedStatus);
      expect(mocks.getSubcomerciales).toHaveBeenCalledWith(
        transaction,
        "commercial-1",
      );
      expect(mocks.execute).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ args: expectedArgs }),
      );
    },
  );

  test.each(["completed", "rejected"])(
    "requires study completion permission for pending to %s",
    async (nextStatus) => {
      currentComparison = { ...currentComparison!, status: "pending" };

      const response = await patch(
        nextStatus,
        nextStatus === "completed" ? { comision_fijo: 50 } : undefined,
      );

      expect(response.status).toBe(200);
      expect(mocks.getEffectivePermission).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({ id: "user-1", role: "1" }),
        "comparisons.study.complete",
      );
      expect(mocks.recordStatusChange).toHaveBeenCalledWith(
        transaction,
        "comparison-1",
        "user-1",
        "pending",
        nextStatus,
      );
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      expect(mocks.rollback).not.toHaveBeenCalled();
    },
  );

  test.each(["completed", "rejected"])(
    "denies pending to %s before every mutation without study completion permission",
    async (nextStatus) => {
      currentComparison = { ...currentComparison!, status: "pending" };
      mocks.getEffectivePermission.mockResolvedValue(false);

      const response = await patch(
        nextStatus,
        nextStatus === "completed" ? { comision_fijo: 50 } : undefined,
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        success: false,
        error: "Forbidden",
      });
      expect(mocks.getEffectivePermission).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({ id: "user-1", role: "1" }),
        "comparisons.study.complete",
      );
      expect(mocks.execute).toHaveBeenCalledTimes(1);
      expect(mocks.recordStatusChange).not.toHaveBeenCalled();
      expect(mocks.recordConvertedToContract).not.toHaveBeenCalled();
      expect(mocks.recordCommissionChange).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
    },
  );

  test("requires review permission for awaiting_review to completed", async () => {
    const response = await patch("completed", { comision_fijo: 50 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.transaction).toHaveBeenCalledWith("write");
    expect(mocks.getEffectivePermission).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ id: "user-1", role: "1" }),
      "comparisons.study.review",
    );
    expect(mocks.recordStatusChange).toHaveBeenCalledWith(
      transaction,
      "comparison-1",
      "user-1",
      "awaiting_review",
      "completed",
    );
    expect(mocks.recordCommissionChange).toHaveBeenCalledWith(
      transaction,
      "comparison-1",
      "user-1",
      "comision_fijo",
      10,
      50,
    );
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  test("denies awaiting_review to completed before every mutation without review permission", async () => {
    mocks.getEffectivePermission.mockResolvedValue(false);

    const response = await patch("completed", { comision_fijo: 50 });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: "Forbidden",
    });
    expect(mocks.getEffectivePermission).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ id: "user-1", role: "1" }),
      "comparisons.study.review",
    );
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.recordStatusChange).not.toHaveBeenCalled();
    expect(mocks.recordConvertedToContract).not.toHaveBeenCalled();
    expect(mocks.recordCommissionChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test.each(["pending", "awaiting_review", "rejected"])(
    "rejects %s to completed without a supplier",
    async (currentStatus) => {
      currentComparison = {
        ...currentComparison!,
        status: currentStatus,
        company_id: null,
      };

      const response = await patch("completed");

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        success: false,
        error: "Comparison status changed",
      });
      expect(
        mocks.execute.mock.calls.some(([statement]) =>
          (statement as { sql: string }).sql.includes(
            "UPDATE comparativas",
          ),
        ),
      ).toBe(false);
      expect(mocks.recordStatusChange).not.toHaveBeenCalled();
      expect(mocks.recordCommissionChange).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["pending", "awaiting_review", "rejected"])(
    "rejects %s to completed with an inactive or missing supplier",
    async (currentStatus) => {
      currentComparison = {
        ...currentComparison!,
        status: currentStatus,
      };
      activeSupplier = false;

      const response = await patch("completed");

      expect(response.status).toBe(409);
      expect(mocks.execute).toHaveBeenCalledWith({
        sql: expect.stringContaining(
          "WHERE id = ? AND active = true",
        ),
        args: ["supplier-1"],
      });
      expect(
        mocks.execute.mock.calls.some(([statement]) =>
          (statement as { sql: string }).sql.includes(
            "UPDATE comparativas",
          ),
        ),
      ).toBe(false);
      expect(mocks.recordStatusChange).not.toHaveBeenCalled();
      expect(mocks.recordCommissionChange).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    {
      name: "fijo plan",
      plan: ["fijo"],
      missing: { comision_fijo: null },
    },
    {
      name: "fijo sales commission",
      plan: ["fijo"],
      missing: { comision_sales_person_fijo: null },
    },
    {
      name: "indexado plan",
      plan: ["indexado"],
      missing: { comision_indexado: null },
    },
    {
      name: "indexado sales commission",
      plan: ["indexado"],
      missing: { comision_sales_person_indexado: null },
    },
    {
      name: "combined plan",
      plan: ["fijo", "indexado"],
      missing: { comision_indexado: null },
    },
    {
      name: "non-finite persisted commission",
      plan: ["fijo"],
      missing: { comision_fijo: Number.NaN },
    },
  ])(
    "rejects completed when commissions are incomplete for $name",
    async ({ plan, missing }) => {
      currentComparison = {
        ...currentComparison!,
        status: "rejected",
        plan: JSON.stringify(plan),
        ...missing,
      };

      const response = await patch("completed");

      expect(response.status).toBe(409);
      expect(
        mocks.execute.mock.calls.some(([statement]) =>
          (statement as { sql: string }).sql.includes(
            "FROM comercializadoras",
          ),
        ),
      ).toBe(false);
      expect(
        mocks.execute.mock.calls.some(([statement]) =>
          (statement as { sql: string }).sql.includes(
            "UPDATE comparativas",
          ),
        ),
      ).toBe(false);
      expect(mocks.recordStatusChange).not.toHaveBeenCalled();
      expect(mocks.recordCommissionChange).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["pending", "awaiting_review", "rejected"])(
    "accepts persisted supplier and commissions for %s to completed",
    async (currentStatus) => {
      currentComparison = {
        ...currentComparison!,
        status: currentStatus,
        plan: JSON.stringify(["fijo", "indexado"]),
      };

      const response = await patch("completed");

      expect(response.status).toBe(200);
      expect(mocks.execute).toHaveBeenCalledWith({
        sql: expect.stringContaining(
          "WHERE id = ? AND active = true",
        ),
        args: ["supplier-1"],
      });
      expect(mocks.commit).toHaveBeenCalledTimes(1);
    },
  );

  test("accepts payload values that complete missing persisted completion data", async () => {
    currentComparison = {
      ...currentComparison!,
      status: "pending",
      company_id: null,
      plan: JSON.stringify(["fijo"]),
      comision_fijo: null,
    };

    const response = await patch(
      "completed",
      { comision_fijo: 42 },
      { company_id: "supplier-2" },
    );

    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith({
      sql: expect.stringContaining(
        "WHERE id = ? AND active = true",
      ),
      args: ["supplier-2"],
    });
    expect(mocks.recordCommissionChange).toHaveBeenCalledWith(
      transaction,
      "comparison-1",
      "user-1",
      "comision_fijo",
      null,
      42,
    );
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["completed", "rechazado_cliente"],
    ["rejected", "pending"],
    ["rejected", "rechazado_cliente"],
    ["rechazado_cliente", "rejected"],
  ])(
    "does not require a study permission for %s to %s",
    async (currentStatus, nextStatus) => {
      currentComparison = { ...currentComparison!, status: currentStatus };
      mocks.getEffectivePermission.mockResolvedValue(false);

      const response = await patch(nextStatus);

      expect(response.status).toBe(200);
      expect(mocks.getEffectivePermission).not.toHaveBeenCalled();
      expect(mocks.commit).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    ["pending", "processed", { tramite_id: "tramite-1" }],
    ["pending", "awaiting_review", {}],
    ["awaiting_review", "rejected", {}],
    ["processed", "completed", {}],
  ])(
    "returns a generic 409 before mutations for invalid transition %s to %s",
    async (currentStatus, nextStatus, fields) => {
      currentComparison = { ...currentComparison!, status: currentStatus };

      const response = await patch(nextStatus, undefined, fields);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        success: false,
        error: "Comparison status changed",
      });
      expect(mocks.getEffectivePermission).not.toHaveBeenCalled();
      expect(mocks.execute).toHaveBeenCalledTimes(1);
      expect(mocks.recordStatusChange).not.toHaveBeenCalled();
      expect(mocks.recordCommissionChange).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    ["pending", { comision_fijo: 50 }, {}],
    ["completed", undefined, { company_id: "company-1" }],
    ["completed", undefined, { tramite_id: "tramite-1" }],
  ])(
    "rejects same-state %s payload fields without applying them",
    async (status, commissions, fields) => {
      currentComparison = { ...currentComparison!, status };

      const response = await patch(status, commissions, fields);

      expect(response.status).toBe(409);
      expect(mocks.execute).toHaveBeenCalledTimes(1);
      expect(mocks.recordStatusChange).not.toHaveBeenCalled();
      expect(mocks.recordCommissionChange).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    ["pending", "rejected", { comision_fijo: 50 }, {}],
    ["completed", "rechazado_cliente", undefined, { company_id: "company-1" }],
    ["pending", "completed", undefined, { tramite_id: "tramite-1" }],
  ])(
    "returns 409 when fields are not valid for %s to %s",
    async (currentStatus, nextStatus, commissions, fields) => {
      currentComparison = { ...currentComparison!, status: currentStatus };

      const response = await patch(nextStatus, commissions, fields);

      expect(response.status).toBe(409);
      expect(mocks.getEffectivePermission).not.toHaveBeenCalled();
      expect(mocks.execute).toHaveBeenCalledTimes(1);
      expect(mocks.recordStatusChange).not.toHaveBeenCalled();
      expect(mocks.recordCommissionChange).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
    },
  );

  test("requires a tramite_id when completed becomes processed", async () => {
    currentComparison = { ...currentComparison!, status: "completed" };

    const response = await patch("processed");

    expect(response.status).toBe(409);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.recordStatusChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("allows completed to processed with a new tramite_id", async () => {
    currentComparison = {
      ...currentComparison!,
      status: "completed",
      tramite_id: null,
    };

    const response = await patch("processed", undefined, {
      tramite_id: "tramite-1",
    });

    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenNthCalledWith(2, {
      sql: "SELECT id FROM tramites WHERE id = ?",
      args: ["tramite-1"],
    });
    const statusUpdate = mocks.execute.mock.calls.find(
      ([statement]) =>
        (statement as { sql: string }).sql.includes(
          "UPDATE comparativas SET status",
        ),
    )?.[0] as { sql: string; args: unknown[] };
    expect(statusUpdate.sql).toContain("AND tramite_id IS NULL");
    expect(mocks.recordConvertedToContract).toHaveBeenCalledWith(
      transaction,
      "comparison-1",
      "user-1",
      "tramite-1",
    );
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  test("rejects reassociating an existing comparison to a different tramite", async () => {
    currentComparison = {
      ...currentComparison!,
      status: "completed",
      tramite_id: "tramite-existing",
    };

    const response = await patch("processed", undefined, {
      tramite_id: "tramite-different",
    });

    expect(response.status).toBe(409);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.recordStatusChange).not.toHaveBeenCalled();
    expect(mocks.recordConvertedToContract).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("normalizes a repeated tramite_id while completing legacy processing", async () => {
    currentComparison = {
      ...currentComparison!,
      status: "completed",
      tramite_id: "tramite-1",
    };

    const response = await patch("processed", undefined, {
      tramite_id: "tramite-1",
    });

    expect(response.status).toBe(200);
    const statusUpdate = mocks.execute.mock.calls.find(
      ([statement]) =>
        (statement as { sql: string }).sql.includes(
          "UPDATE comparativas SET status",
        ),
    )?.[0] as { sql: string; args: unknown[] };
    expect(statusUpdate.sql).not.toContain(
      "SET status = ?, tramite_id = ?",
    );
    expect(statusUpdate.sql).toContain("AND tramite_id = ?");
    expect(statusUpdate.args.at(-1)).toBe("tramite-1");
    expect(
      mocks.execute.mock.calls.some(([statement]) =>
        (statement as { sql: string }).sql.includes(
          "SELECT id FROM tramites",
        ),
      ),
    ).toBe(false);
    expect(mocks.recordConvertedToContract).not.toHaveBeenCalled();
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  test("uses an existing tramite association when the legacy payload omits it", async () => {
    currentComparison = {
      ...currentComparison!,
      status: "completed",
      tramite_id: "tramite-existing",
    };

    const response = await patch("processed");

    expect(response.status).toBe(200);
    const statusUpdate = mocks.execute.mock.calls.find(
      ([statement]) =>
        (statement as { sql: string }).sql.includes(
          "UPDATE comparativas SET status",
        ),
    )?.[0] as { sql: string; args: unknown[] };
    expect(statusUpdate.sql).not.toContain(
      "SET status = ?, tramite_id = ?",
    );
    expect(statusUpdate.sql).toContain("AND tramite_id = ?");
    expect(statusUpdate.args.at(-1)).toBe("tramite-existing");
    expect(
      mocks.execute.mock.calls.some(([statement]) =>
        (statement as { sql: string }).sql.includes(
          "SELECT id FROM tramites",
        ),
      ),
    ).toBe(false);
    expect(mocks.recordConvertedToContract).not.toHaveBeenCalled();
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  test("rejects a missing tramite before status update or audit", async () => {
    currentComparison = {
      ...currentComparison!,
      status: "completed",
      tramite_id: null,
    };
    accessibleTramite = false;

    const response = await patch("processed", undefined, {
      tramite_id: "tramite-missing",
    });

    expect(response.status).toBe(409);
    expect(mocks.execute).toHaveBeenNthCalledWith(2, {
      sql: "SELECT id FROM tramites WHERE id = ?",
      args: ["tramite-missing"],
    });
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.recordStatusChange).not.toHaveBeenCalled();
    expect(mocks.recordConvertedToContract).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("rejects a tramite outside a role 2 hierarchy", async () => {
    currentComparison = {
      ...currentComparison!,
      status: "completed",
      tramite_id: null,
    };
    accessibleTramite = false;
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "commercial-1",
        role: "2",
        email: "commercial@example.com",
        name: "Commercial",
      },
    });
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["subordinate-1"],
    });

    const response = await patch("processed", undefined, {
      tramite_id: "tramite-1",
    });

    expect(response.status).toBe(409);
    expect(mocks.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining("AND user_id IN (?, ?)"),
        args: [
          "tramite-1",
          "commercial-1",
          "subordinate-1",
        ],
      }),
    );
    expect(mocks.recordStatusChange).not.toHaveBeenCalled();
    expect(mocks.recordConvertedToContract).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("allows a role 2 user to associate an accessible tramite", async () => {
    currentComparison = {
      ...currentComparison!,
      status: "completed",
      tramite_id: null,
    };
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "commercial-1",
        role: "2",
        email: "commercial@example.com",
        name: "Commercial",
      },
    });
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["subordinate-1"],
    });

    const response = await patch("processed", undefined, {
      tramite_id: "tramite-1",
    });

    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining("AND user_id IN (?, ?)"),
        args: [
          "tramite-1",
          "commercial-1",
          "subordinate-1",
        ],
      }),
    );
    expect(mocks.recordConvertedToContract).toHaveBeenCalledTimes(1);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  test("blocks role 2 from recovering a rejected comparison", async () => {
    currentComparison = { ...currentComparison!, status: "rejected" };
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "commercial-1",
        role: "2",
        email: "commercial@example.com",
        name: "Commercial",
      },
    });

    const response = await patch("pending");

    expect(response.status).toBe(409);
    expect(mocks.getEffectivePermission).not.toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.recordStatusChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("requires completion permission when privileged users recover to completed", async () => {
    currentComparison = { ...currentComparison!, status: "rejected" };
    mocks.getEffectivePermission.mockResolvedValue(false);

    const response = await patch("completed");

    expect(response.status).toBe(403);
    expect(mocks.getEffectivePermission).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ role: "1" }),
      "comparisons.study.complete",
    );
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.recordStatusChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("allows admin through the shared permission resolver", async () => {
    currentComparison = { ...currentComparison!, status: "pending" };
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "admin-1",
        role: "admin",
        email: "admin@example.com",
        name: "Admin",
      },
    });

    const response = await patch("completed");

    expect(response.status).toBe(200);
    expect(mocks.getEffectivePermission).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ id: "admin-1", role: "admin" }),
      "comparisons.study.complete",
    );
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  test("uses a compare-and-swap update and rolls back with 409 on a status race", async () => {
    statusRowsAffected = 0;

    const response = await patch("completed");

    expect(response.status).toBe(409);
    const statusUpdate = mocks.execute.mock.calls.find(
      ([statement]) =>
        (statement as { sql: string }).sql.includes(
          "UPDATE comparativas SET status",
        ),
    )?.[0] as { sql: string; args: unknown[] };
    expect(statusUpdate.sql).toContain("WHERE id = ? AND status = ?");
    expect(statusUpdate.args.slice(-2)).toEqual([
      "comparison-1",
      "awaiting_review",
    ]);
    expect(mocks.recordStatusChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("returns 400 for invalid JSON before opening a transaction", async () => {
    const invalidRequest = new NextRequest(
      "https://tenant.example.com/api/v2/comparisons/comparison-1/status",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{",
      },
    );

    const response = await patchRequest(invalidRequest);

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("returns 400 for a validation error before opening a transaction", async () => {
    const response = await patch("");

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("returns 400 for an unknown status before accessing the database", async () => {
    const response = await patch("unknown_status");

    expect(response.status).toBe(400);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "path with spaces",
      comparisonId: "comparison 1",
      status: "completed",
      fields: {},
    },
    {
      name: "oversized path",
      comparisonId: "a".repeat(129),
      status: "completed",
      fields: {},
    },
    {
      name: "unsafe path",
      comparisonId: "../comparison-1",
      status: "completed",
      fields: {},
    },
    {
      name: "tramite with spaces",
      comparisonId: "comparison-1",
      status: "processed",
      fields: { tramite_id: "tramite 1" },
    },
    {
      name: "oversized tramite",
      comparisonId: "comparison-1",
      status: "processed",
      fields: { tramite_id: "a".repeat(129) },
    },
    {
      name: "unsafe company",
      comparisonId: "comparison-1",
      status: "completed",
      fields: { company_id: "company/1" },
    },
  ])(
    "returns 400 before database access for $name",
    async ({ comparisonId, status, fields }) => {
      const response = await patchRequest(
        request(status, undefined, fields),
        comparisonId,
      );

      expect(response.status).toBe(400);
      expect(mocks.getTursoClient).not.toHaveBeenCalled();
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.execute).not.toHaveBeenCalled();
    },
  );

  test("trims a valid comparison path before querying", async () => {
    const response = await patchRequest(
      request("completed"),
      " comparison-1 ",
    );

    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ args: ["comparison-1"] }),
    );
  });

  test("returns a generic 500 when the database client is unavailable", async () => {
    mocks.getTursoClient.mockReturnValue(null);

    const response = await patch("completed");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Internal server error",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("returns 404 and rolls back when the comparison is not accessible", async () => {
    currentComparison = undefined;

    const response = await patch("completed");

    expect(response.status).toBe(404);
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });

  test("rolls back all work and returns a generic 500 when auditing fails", async () => {
    mocks.recordStatusChange.mockRejectedValue(
      new Error("sensitive database detail"),
    );

    const response = await patch("completed", { comision_fijo: 50 });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: "Internal server error",
    });
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
  });
});
