import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getTursoClient: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));

const { POST } = await import("./route");

function request(id = "user-1") {
  return new Request(
    "https://tenant.example.com/api/v2/analytics/contracts/personal",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, time_range: "year" }),
    },
  ) as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: { id: "user-1", role: "2" },
  });
});

describe("POST personal contract analytics", () => {
  test("rejects access to another user's analytics", async () => {
    const response = await POST(request("other-user"));

    expect(response.status).toBe(403);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
  });

  test("does not query or return commissions for a subcommercial", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { id: "user-1", role: "admin" },
    });
    mocks.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("SELECT super_id FROM user")) {
        return { rows: [{ super_id: "manager-1" }] };
      }
      return {
        rows: [{ date: "2026-09-01", active: 2, baja: 1 }],
      };
    });

    const response = await POST(request());
    const body = await response.json();
    const analyticsQuery = mocks.execute.mock.calls.find(([query]) =>
      String(query.sql).includes("FROM tramites"),
    )?.[0];

    expect(response.status).toBe(200);
    expect(analyticsQuery.sql).not.toContain("SUM(comision)");
    expect(analyticsQuery.sql).not.toContain("SUM(comision_sales_person)");
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "Septiembre", active: 2, baja: 1 }),
      ]),
    );
    expect(
      body.data.some((item: Record<string, unknown>) => "comision" in item),
    ).toBe(false);
    expect(
      body.data.some(
        (item: Record<string, unknown>) => "comision_sales_person" in item,
      ),
    ).toBe(false);
  });
});
