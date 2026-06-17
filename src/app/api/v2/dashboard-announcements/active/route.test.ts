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
    user: { id: "user1", role: "2", email: "u@b.com", name: "User" },
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

const request = new Request("https://x/api") as unknown as NextRequest;

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.sessionResult = {
    success: true,
    user: { id: "user1", role: "2", email: "u@b.com", name: "User" },
  };
  mocks.executeImpl = async () => ({
    rows: [
      {
        id: "ann1",
        title: "Aviso",
        message: "Mensaje",
        variant: "info",
        cta_label: null,
        cta_url: null,
        is_active: 1,
        created_by: "admin1",
        created_by_name: "Admin",
        created_at: "2026-06-16T08:00:00.000Z",
        updated_at: "2026-06-16T08:00:00.000Z",
        deactivated_at: null,
      },
    ],
  });
});

describe("GET /dashboard-announcements/active", () => {
  test("returns 401 unauthenticated", async () => {
    mocks.sessionResult = { success: false };

    const res = await route.GET(request);

    expect(res.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("returns active announcement for authenticated users", async () => {
    const res = await route.GET(request);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      title: "Aviso",
      is_active: true,
    });
  });
});
