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
  new Request("https://x/api/v2/forum/topics", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

const topicRow = {
  id: "topic1",
  title: "Debate diario",
  description: "Tema abierto",
  status: "open",
  created_by_name: "Admin",
  comments_count: 2,
  visible_comments_count: 2,
  created_at: "2026-06-16T08:00:00.000Z",
  updated_at: "2026-06-16T08:00:00.000Z",
  closed_at: null,
};

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
  mocks.executeImpl = async (statement) => {
    if (statement.sql.includes("INSERT INTO forum_topics")) {
      return { rows: [], rowsAffected: 1 };
    }
    if (statement.sql.includes("FROM forum_comments c")) {
      return { rows: [] };
    }
    return { rows: [topicRow], rowsAffected: 1 };
  };
});

describe("POST /forum/topics", () => {
  test("returns 401 unauthenticated", async () => {
    mocks.sessionResult = { success: false };

    const res = await route.POST(createRequest({ title: "Debate" }));

    expect(res.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

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

    const res = await route.POST(createRequest({ title: "Debate" }));

    expect(res.status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("creates topics for management users", async () => {
    const res = await route.POST(createRequest({ title: "Debate diario" }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Debate diario");
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("INSERT INTO forum_topics"),
      }),
    );
  });
});
