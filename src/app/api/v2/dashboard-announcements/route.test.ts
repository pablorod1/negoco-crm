import { beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";

type MockStatement = { sql: string; args?: unknown[] };
type MockSession = {
  success: boolean;
  user?: { id: string; role: string; email: string; name: string };
};

const mocks = vi.hoisted(() => ({
  executeImpl: undefined as
    | undefined
    | ((statement: MockStatement) => Promise<unknown>),
  execute: vi.fn((statement: MockStatement) => mocks.executeImpl?.(statement)),
  getTursoClient: vi.fn(),
  sessionResult: {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  } as MockSession,
}));

mocks.getTursoClient.mockImplementation(() => ({ execute: mocks.execute }));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("/src/core/libsql/client.ts", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: () => mocks.sessionResult,
}));
vi.mock("/src/core/auth/session-utils.ts", () => ({
  validateUserSession: () => mocks.sessionResult,
}));

const route = await import("./route");

const createRequest = (body: unknown) =>
  new Request("https://x/api", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

const announcementRow = {
  id: "ann1",
  title: "Aviso diario",
  message: "Revisar operaciones pendientes",
  variant: "warning",
  cta_label: null,
  cta_url: null,
  is_active: 1,
  created_by: "admin1",
  created_by_name: "Admin",
  created_at: "2026-06-16T08:00:00.000Z",
  updated_at: "2026-06-16T08:00:00.000Z",
  deactivated_at: null,
};

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
  mocks.executeImpl = async (statement) => {
    if (statement.sql.includes("SELECT a.*")) {
      return { rows: [announcementRow], rowsAffected: 1 };
    }

    return { rows: [], rowsAffected: 1 };
  };
});

describe("POST /dashboard-announcements", () => {
  test("returns 403 for non-management users", async () => {
    mocks.sessionResult = {
      success: true,
      user: {
        id: "backoffice1",
        role: "1",
        email: "bo@test.com",
        name: "Backoffice",
      },
    };

    const res = await route.POST(
      createRequest({
        title: "Aviso",
        message: "Mensaje",
        variant: "info",
      }),
    );

    expect(res.status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("deactivates the active announcement before creating a new one", async () => {
    const res = await route.POST(
      createRequest({
        title: "Aviso diario",
        message: "Revisar operaciones pendientes",
        variant: "warning",
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe("Aviso diario");
    expect(mocks.execute.mock.calls[0][0].sql).toContain(
      "UPDATE dashboard_announcements",
    );
    expect(mocks.execute.mock.calls[1][0].sql).toContain(
      "INSERT INTO dashboard_announcements",
    );
  });
});
