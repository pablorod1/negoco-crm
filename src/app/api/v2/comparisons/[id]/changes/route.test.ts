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
