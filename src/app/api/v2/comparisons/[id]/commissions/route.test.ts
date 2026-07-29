import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  commit: vi.fn(),
  createComparativaChange: vi.fn(),
  execute: vi.fn(),
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
vi.mock("@/comparativas/utils/comparativaChangesHelpers", () => ({
  createComparativaChange: mocks.createComparativaChange,
}));

const route = await import("./route");

type ComparisonRow = {
  status: string;
  plan: string;
  comision_fijo: unknown;
  comision_indexado: unknown;
  comision_sales_person_fijo: unknown;
  comision_sales_person_indexado: unknown;
};

type Statement = {
  sql: string;
  args: unknown[];
};

const authenticatedUser = {
  id: "session-user",
  role: "1",
  email: "user@example.com",
  name: "Session User",
};

const transaction = {
  execute: mocks.execute,
  commit: mocks.commit,
  rollback: mocks.rollback,
  close: mocks.close,
};

let currentComparison: ComparisonRow | undefined;
let updateRowsAffected: number;
let updateError: Error | undefined;

function request(body: unknown) {
  return new NextRequest(
    "https://tenant.example.com/api/v2/comparisons/comparison-1/commissions",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function malformedRequest() {
  return new NextRequest(
    "https://tenant.example.com/api/v2/comparisons/comparison-1/commissions",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{",
    },
  );
}

function patchRequest(req: NextRequest, comparisonId = "comparison-1") {
  return route.PATCH(req, {
    params: Promise.resolve({ id: comparisonId }),
  });
}

function patch(body: unknown, comparisonId = "comparison-1") {
  return patchRequest(request(body), comparisonId);
}

function findUpdateStatement(): Statement {
  const call = mocks.execute.mock.calls.find(([statement]) =>
    String((statement as Statement).sql)
      .trimStart()
      .startsWith("UPDATE comparativas"),
  );

  expect(call).toBeDefined();
  return call?.[0] as Statement;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentComparison = {
    status: "completed",
    plan: JSON.stringify(["fijo", "indexado"]),
    comision_fijo: 10,
    comision_indexado: 20,
    comision_sales_person_fijo: 5,
    comision_sales_person_indexado: 8,
  };
  updateRowsAffected = 1;
  updateError = undefined;

  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: authenticatedUser,
  });
  mocks.getTursoClient.mockReturnValue({
    transaction: mocks.transaction,
  });
  mocks.transaction.mockResolvedValue(transaction);
  mocks.close.mockResolvedValue(undefined);
  mocks.commit.mockResolvedValue(undefined);
  mocks.rollback.mockResolvedValue(undefined);
  mocks.createComparativaChange.mockResolvedValue(true);
  mocks.execute.mockImplementation(async (statement: Statement) => {
    if (
      statement.sql.trimStart().startsWith("SELECT") &&
      statement.sql.includes("comision_sales_person_indexado")
    ) {
      return {
        rows: currentComparison ? [{ ...currentComparison }] : [],
        rowsAffected: 0,
      };
    }

    if (statement.sql.trimStart().startsWith("UPDATE comparativas")) {
      if (updateError) throw updateError;
      return { rows: [], rowsAffected: updateRowsAffected };
    }

    throw new Error(`Unexpected SQL in test: ${statement.sql}`);
  });
});

describe("PATCH /api/v2/comparisons/[id]/commissions", () => {
  test("returns 401 before parsing the body or accessing the database", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await patchRequest(malformedRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("returns 403 for every role other than exact admin or 1 before parsing or writing", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { ...authenticatedUser, role: "2" },
    });

    const response = await patchRequest(malformedRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: "Forbidden",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test.each(["Admin", "01", "superadmin", ""])(
    "does not broaden privileged role matching to %j",
    async (role) => {
      mocks.validateUserSession.mockResolvedValue({
        success: true,
        user: { ...authenticatedUser, role },
      });

      const response = await patch({
        comissions: { comision_fijo: 12 },
      });

      expect(response.status).toBe(403);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  test("allows the exact admin role", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { ...authenticatedUser, role: "admin" },
    });

    const response = await patch({
      comissions: { comision_fijo: 12 },
    });

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith("write");
  });

  test.each(["", "../comparison", "comparison id", "x".repeat(129)])(
    "returns 400 for unsafe comparison id %j",
    async (comparisonId) => {
      const response = await patch(
        { comissions: { comision_fijo: 12 } },
        comparisonId,
      );

      expect(response.status).toBe(400);
      expect(mocks.getTursoClient).not.toHaveBeenCalled();
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  test.each([
    { name: "malformed JSON", request: malformedRequest },
    { name: "missing comissions", request: () => request({}) },
    {
      name: "empty comissions",
      request: () => request({ comissions: {} }),
    },
    {
      name: "only empty commission values",
      request: () =>
        request({ comissions: { comision_fijo: "" } }),
    },
    {
      name: "only null commission values",
      request: () =>
        request({ comissions: { comision_fijo: null } }),
    },
    {
      name: "only null and empty commission values",
      request: () =>
        request({
          comissions: {
            comision_fijo: null,
            comision_indexado: "",
          },
        }),
    },
    {
      name: "non-finite numeric text",
      request: () =>
        request({ comissions: { comision_fijo: "Infinity" } }),
    },
    {
      name: "unknown commission field",
      request: () =>
        request({ comissions: { comision_variable: 10 } }),
    },
  ])("returns 400 for $name", async ({ request: makeRequest }) => {
    const response = await patchRequest(makeRequest());

    expect(response.status).toBe(400);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("returns 500 when the database client is unavailable", async () => {
    mocks.getTursoClient.mockReturnValue(null);

    const response = await patch({
      comissions: { comision_fijo: 12 },
    });

    expect(response.status).toBe(500);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("returns 404 and rolls back when the comparison is missing", async () => {
    currentComparison = undefined;

    const response = await patch({
      comissions: { comision_fijo: 12 },
    });

    expect(response.status).toBe(404);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.rollback.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.close.mock.invocationCallOrder[0],
    );
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
  });

  test.each([
    "pending",
    "awaiting_review",
    "processed",
    "rejected",
    "rechazado_cliente",
  ])(
    "returns 409 without update or audit when current status is %s",
    async (status) => {
      currentComparison = { ...currentComparison!, status };

      const response = await patch({
        comissions: { comision_fijo: 12 },
      });

      expect(response.status).toBe(409);
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.createComparativaChange).not.toHaveBeenCalled();
      expect(
        mocks.execute.mock.calls.some(([statement]) =>
          String((statement as Statement).sql)
            .trimStart()
            .startsWith("UPDATE comparativas"),
        ),
      ).toBe(false);
    },
  );

  test.each([
    {
      plan: ["fijo"],
      comissions: { comision_indexado: 30 },
    },
    {
      plan: ["fijo"],
      comissions: { comision_sales_person_indexado: 12 },
    },
    {
      plan: ["indexado"],
      comissions: { comision_fijo: 30 },
    },
    {
      plan: ["indexado"],
      comissions: { comision_sales_person_fijo: 12 },
    },
  ])(
    "rejects stale commission fields $comissions for plan $plan",
    async ({ plan, comissions }) => {
      currentComparison = {
        ...currentComparison!,
        plan: JSON.stringify(plan),
      };

      const response = await patch({ comissions });

      expect(response.status).toBe(409);
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.createComparativaChange).not.toHaveBeenCalled();
      expect(mocks.execute).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    {
      plan: ["fijo"],
      comissions: {
        comision_fijo: 30,
        comision_sales_person_fijo: 12,
      },
    },
    {
      plan: ["indexado"],
      comissions: {
        comision_indexado: 30,
        comision_sales_person_indexado: 12,
      },
    },
  ])(
    "accepts all active single-plan fields for $plan",
    async ({ plan, comissions }) => {
      currentComparison = {
        ...currentComparison!,
        plan: JSON.stringify(plan),
      };

      const response = await patch({ comissions });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      expect(mocks.rollback).not.toHaveBeenCalled();
    },
  );

  test("accepts all four commission fields when both plans are active", async () => {
    const response = await patch({
      comissions: {
        comision_fijo: 30,
        comision_indexado: 40,
        comision_sales_person_fijo: 12,
        comision_sales_person_indexado: 16,
      },
    });

    expect(response.status).toBe(200);
    expect(findUpdateStatement()).toEqual({
      sql: expect.stringContaining("UPDATE comparativas"),
      args: [30, 40, 12, 16, "comparison-1"],
    });
    expect(mocks.createComparativaChange).toHaveBeenCalledTimes(4);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  test("does not include or overwrite inactive and omitted commission fields", async () => {
    currentComparison = {
      ...currentComparison!,
      plan: JSON.stringify(["fijo"]),
      comision_indexado: 321,
      comision_sales_person_indexado: 654,
    };

    const response = await patch({
      comissions: { comision_fijo: 30 },
    });

    const update = findUpdateStatement();
    expect(response.status).toBe(200);
    expect(update.sql).toContain("comision_fijo = ?");
    expect(update.sql).not.toContain("comision_indexado = ?");
    expect(update.sql).not.toContain(
      "comision_sales_person_indexado = ?",
    );
    expect(update.args).toEqual([30, "comparison-1"]);
    expect(currentComparison.comision_indexado).toBe(321);
    expect(currentComparison.comision_sales_person_indexado).toBe(654);
  });

  test("ignores forged legacy user_id and audits only changed submitted fields", async () => {
    const response = await patch({
      comissions: {
        comision_fijo: 15.5,
        comision_indexado: 20,
      },
      user_id: "forged-user",
    });

    expect(response.status).toBe(200);
    expect(mocks.createComparativaChange.mock.calls).toEqual([
      [
        transaction,
        {
          comparativa_id: "comparison-1",
          user_id: "session-user",
          change_type: "commission_update",
          field_name: "comision_fijo",
          old_value: "10",
          new_value: "15.5",
          description: "Comisión fija actualizada de 10€ a 15.5€",
        },
      ],
    ]);
    expect(findUpdateStatement().args).toEqual([
      15.5,
      20,
      "comparison-1",
    ]);
  });

  test.each([
    { input: 0, expected: 0 },
    { input: 42.25, expected: 42.25 },
    { input: "42.25", expected: 42.25 },
    { input: "42,25", expected: 42.25 },
  ])(
    "retains numeric compatibility for $input",
    async ({ input, expected }) => {
      const response = await patch({
        comissions: { comision_fijo: input },
      });

      expect(response.status).toBe(200);
      expect(findUpdateStatement().args).toEqual([
        expected,
        "comparison-1",
      ]);
    },
  );

  test("treats null and empty values as omitted when another field is valid", async () => {
    const response = await patch({
      comissions: {
        comision_fijo: null,
        comision_indexado: "",
        comision_sales_person_fijo: 15,
      },
    });

    expect(response.status).toBe(200);
    const update = findUpdateStatement();
    expect(update.sql).not.toContain("comision_fijo = ?");
    expect(update.sql).not.toContain("comision_indexado = ?");
    expect(update.sql).toContain("comision_sales_person_fijo = ?");
    expect(update.args).toEqual([15, "comparison-1"]);
    expect(mocks.createComparativaChange).toHaveBeenCalledTimes(1);
    expect(mocks.createComparativaChange).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        field_name: "comision_sales_person_fijo",
        old_value: "5",
        new_value: "15",
      }),
    );
  });

  test.each([
    "",
    "   ",
    "not-a-number",
    "Infinity",
    "-Infinity",
    "NaN",
    "0x10",
    "0b10",
    "0o10",
  ])(
    "rolls back on malformed persisted commission text %j",
    async (storedValue) => {
      currentComparison = {
        ...currentComparison!,
        comision_fijo: storedValue,
      };

      const response = await patch({
        comissions: { comision_fijo: 15 },
      });

      expect(response.status).toBe(500);
      expect(mocks.rollback).toHaveBeenCalledTimes(1);
      expect(mocks.close).toHaveBeenCalledTimes(1);
      expect(mocks.createComparativaChange).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.execute).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    { storedValue: 12.5, expectedOldValue: "12.5" },
    { storedValue: "12.5", expectedOldValue: "12.5" },
    { storedValue: "-12.5", expectedOldValue: "-12.5" },
    { storedValue: "1.25e2", expectedOldValue: "125" },
    { storedValue: null, expectedOldValue: "0" },
  ])(
    "supports persisted commission value $storedValue",
    async ({ storedValue, expectedOldValue }) => {
      currentComparison = {
        ...currentComparison!,
        comision_fijo: storedValue,
      };

      const response = await patch({
        comissions: { comision_fijo: 15 },
      });

      expect(response.status).toBe(200);
      expect(mocks.createComparativaChange).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          field_name: "comision_fijo",
          old_value: expectedOldValue,
          new_value: "15",
        }),
      );
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      expect(mocks.close).toHaveBeenCalledTimes(1);
    },
  );

  test("returns 409 and rolls back when the update affects zero rows", async () => {
    updateRowsAffected = 0;

    const response = await patch({
      comissions: { comision_fijo: 15 },
    });

    expect(response.status).toBe(409);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  test("rolls back the update when the audit helper returns false", async () => {
    mocks.createComparativaChange.mockResolvedValue(false);

    const response = await patch({
      comissions: { comision_fijo: 15 },
    });

    expect(response.status).toBe(500);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  test("rolls back the update when the audit helper throws", async () => {
    mocks.createComparativaChange.mockRejectedValue(
      new Error("audit unavailable"),
    );

    const response = await patch({
      comissions: { comision_fijo: 15 },
    });

    expect(response.status).toBe(500);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  test("rolls back when the update fails", async () => {
    updateError = new Error("write failed");

    const response = await patch({
      comissions: { comision_fijo: 15 },
    });

    expect(response.status).toBe(500);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  test("rolls back, closes, and returns 500 when commit rejects", async () => {
    mocks.commit.mockRejectedValue(new Error("commit failed"));

    const response = await patch({
      comissions: { comision_fijo: 15 },
    });

    expect(response.status).toBe(500);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.rollback.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.close.mock.invocationCallOrder[0],
    );
  });

  test("closes without retrying when rollback rejects", async () => {
    currentComparison = undefined;
    mocks.rollback.mockRejectedValue(new Error("rollback failed"));

    const response = await patch({
      comissions: { comision_fijo: 15 },
    });

    expect(response.status).toBe(500);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  test("treats a malformed stored plan as an internal invariant failure", async () => {
    currentComparison = {
      ...currentComparison!,
      plan: "{not-json",
    };

    const response = await patch({
      comissions: { comision_fijo: 15 },
    });

    expect(response.status).toBe(500);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.createComparativaChange).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  test("commits a successful update exactly once", async () => {
    const response = await patch({
      comissions: { comision_fijo: 15 },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.transaction).toHaveBeenCalledWith("write");
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.close.mock.invocationCallOrder[0],
    );
  });
});
