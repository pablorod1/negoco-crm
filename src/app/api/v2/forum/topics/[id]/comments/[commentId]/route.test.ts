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
    method: "PATCH",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
  mocks.executeImpl = async (statement) => {
    if (statement.sql.includes("UPDATE forum_comments")) {
      return { rows: [], rowsAffected: 1 };
    }

    return {
      rows: [
        {
          id: "comment1",
          topic_id: "topic1",
          message: "Comentario sensible",
          alias_label: "Usuario 2",
          author_id: "user2",
          author_name: "Persona Real",
          author_email: "real@test.com",
          author_role: "2",
          is_hidden: 1,
          hidden_at: "2026-06-16T08:10:00.000Z",
          hidden_by_name: "Admin",
          created_at: "2026-06-16T08:00:00.000Z",
          updated_at: "2026-06-16T08:10:00.000Z",
        },
      ],
      rowsAffected: 1,
    };
  };
});

describe("PATCH /forum/topics/[id]/comments/[commentId]", () => {
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

    const res = await route.PATCH(createRequest({ is_hidden: true }), {
      params: Promise.resolve({ commentId: "comment1" }),
    });

    expect(res.status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("allows management to hide comments", async () => {
    const res = await route.PATCH(createRequest({ is_hidden: true }), {
      params: Promise.resolve({ commentId: "comment1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      id: "comment1",
      is_hidden: true,
      hidden_by_name: "Admin",
    });
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("UPDATE forum_comments"),
      }),
    );
  });
});
