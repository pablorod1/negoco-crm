import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getTursoClient: vi.fn(),
  validateUserSession: vi.fn(),
  getObjectivesTramitesValues: vi.fn(),
  getComparativasRatio: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("@/core/libsql/objectives/getObjectivesHelpers", () => ({
  getObjectivesTramitesValues: mocks.getObjectivesTramitesValues,
  getComparativasRatio: mocks.getComparativasRatio,
}));

const objectivesRoute = await import("./route");
const currentObjectivesRoute = await import("./current/route");

const handlers = [
  ["history", objectivesRoute.GET, "/api/v2/objectives?id=user-1"],
  [
    "current",
    currentObjectivesRoute.GET,
    "/api/v2/objectives/current?id=user-1",
  ],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: { id: "user-1", role: "2" },
  });
  mocks.getObjectivesTramitesValues.mockResolvedValue({
    active: 3,
    comision: 42,
  });
  mocks.getComparativasRatio.mockResolvedValue(50);
});

describe.each(handlers)("GET objectives %s", (_label, handler, path) => {
  test("rejects requests for another user's objectives", async () => {
    const request = new Request(
      `https://tenant.example.com${path.replace("user-1", "other-user")}`,
    ) as NextRequest;

    const response = await handler(request);

    expect(response.status).toBe(403);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
  });

  test("filters commission objectives using the authenticated user's database profile", async () => {
    mocks.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("SELECT super_id FROM user")) {
        return { rows: [{ super_id: "manager-1" }] };
      }
      return {
        rows: [
          {
            id: "objective-1",
            type: "tramites",
            peak: 10,
            current: 0,
            period: "septiembre 2026",
            created_at: "2026-09-01",
            completed: 0,
            user_id: "user-1",
          },
        ],
      };
    });
    const request = new Request(
      `https://tenant.example.com${path}`,
    ) as NextRequest;

    const response = await handler(request);
    const body = await response.json();
    const objectivesQuery = mocks.execute.mock.calls.find(([query]) =>
      String(query.sql).includes("FROM objectives"),
    )?.[0];

    expect(response.status).toBe(200);
    expect(objectivesQuery.sql).toContain("type != 'comisiones'");
    expect(body.data).toEqual([
      expect.objectContaining({ type: "tramites", current: 3 }),
    ]);
    expect(body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "comisiones" })]),
    );
  });
});
