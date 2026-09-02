import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getComparativaChanges: vi.fn(),
  getSubcomerciales: vi.fn(),
  getTursoClient: vi.fn(),
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
  getComparativaChanges: mocks.getComparativaChanges,
}));

const route = await import("./route");

function get(comparisonId = "comparison-1") {
  const request = new NextRequest(
    `https://tenant.example.com/api/v2/comparisons/${comparisonId}/changes`,
  );

  return route.GET(request, {
    params: Promise.resolve({ id: comparisonId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: {
      id: "user-1",
      role: "1",
      email: "user@example.com",
      name: "User",
    },
  });
  mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
  mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
  mocks.execute.mockResolvedValue({ rows: [{ 1: 1 }] });
  mocks.getComparativaChanges.mockResolvedValue([]);
});

describe("GET /api/v2/comparisons/[id]/changes", () => {
  test.each(["old_value", "new_value", "description"])("hides ambiguous compounds in %s, including descriptions of plan changes", async (location) => {
    mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role: "2" } });
    const values = ['{"fijo":98765}', '[98765,12345]'];
    mocks.getComparativaChanges.mockResolvedValue(values.flatMap((value, index) => [
      { id: `result-${index}`, change_type: "general_update", field_name: "result", old_value: null, new_value: null, description: null, [location]: value },
      { id: `plan-${index}`, change_type: "plan_update", field_name: "plan", old_value: null, new_value: null, description: null, [location]: value },
    ]));
    const body = await (await get()).json();
    expect(body.data).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/98765|12345/);
  });
  test.each([
    ["result", '{"fijo":98765}'],
    [null, '[98765,12345]'],
    ["result", '  [98765,12345]'],
    ["plan", '["fijo",98765]'],
    ["plan", '{"fijo":98765}'],
    ["plan", '[98765'],
  ])("hides untrusted compound history with field %s and value %s", async (field, value) => {
    mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role: "2" } });
    mocks.getComparativaChanges.mockResolvedValue([
      { id: "new-compound", change_type: "general_update", field_name: field, old_value: null, new_value: value },
      { id: "old-compound", change_type: "general_update", field_name: field, old_value: value, new_value: null },
      { id: "safe-plan", change_type: "plan_update", field_name: "plan", old_value: '["fijo"]', new_value: '["fijo","indexado"]' },
      { id: "safe-status", change_type: "status_change", field_name: "status", old_value: "pending", new_value: "completed" },
    ]);
    const body = await (await get()).json();
    expect(body.data.map((row: { id: string }) => row.id)).toEqual(["safe-plan", "safe-status"]);
    expect(JSON.stringify(body)).not.toMatch(/98765|12345/);
  });
  test.each(["admin", "1"])("retains agency history for role %s", async (role) => {
    mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role } });
    const audit = { id: "agency", field_name: "comision_fijo", old_value: "98765", new_value: "12345", description: "Comisión 98765" };
    mocks.getComparativaChanges.mockResolvedValue([audit]);
    expect((await (await get()).json()).data).toEqual([audit]);
  });
  test("hides historical agency values and compound descriptions from role2", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role: "2" } });
    mocks.getComparativaChanges.mockResolvedValue([
      { id: "agency", field_name: "comision_fijo", old_value: "98765", new_value: "12345", description: "Comisión 98765" },
      { id: "compound", field_name: null, change_type: "commission_update", old_value: '{"agency":98765}', new_value: "12345" },
      { id: "sales", field_name: "comision_sales_person_fijo", old_value: "0", new_value: "10", description: "Agencia 98765; comercial 10" },
      { id: "plan", field_name: "plan", old_value: '["fijo"]', new_value: '["indexado"]' },
      { id: "type", field_name: "study_result_type", old_value: null, new_value: "fijo" },
    ]);
    const body = await (await get()).json();
    expect(body.data.map((row: { id: string }) => row.id)).toEqual(["sales", "plan", "type"]);
    expect(JSON.stringify(body)).not.toMatch(/98765|12345/);
  });
  test("returns 401 without a session and never opens the database", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await get();

    expect(response.status).toBe(401);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.getComparativaChanges).not.toHaveBeenCalled();
  });

  test("returns the change history for a visible comparison", async () => {
    mocks.getComparativaChanges.mockResolvedValue([
      { id: "change-1" },
    ]);

    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [{ id: "change-1" }],
    });
  });

  test("scopes visibility to the commercial hierarchy", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "user-2",
        role: "2",
        email: "commercial@example.com",
        name: "Commercial",
      },
    });
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["user-3"],
    });

    await get();

    const [statement] = mocks.execute.mock.calls[0] as [
      { sql: string; args: unknown[] },
    ];
    expect(statement.sql).toContain("user_id IN (?, ?)");
    expect(statement.args).toEqual(["comparison-1", "user-2", "user-3"]);
  });

  test("returns 404 when the comparison is not visible to the caller", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });

    const response = await get();

    expect(response.status).toBe(404);
    expect(mocks.getComparativaChanges).not.toHaveBeenCalled();
  });
});
