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

const createRequest = (body?: unknown, method = "GET") =>
  new Request("https://x/api", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;

const topicRow = {
  id: "topic1",
  title: "Debate diario",
  description: "Tema abierto",
  status: "open",
  created_by_name: "Admin",
  comments_count: 2,
  visible_comments_count: 1,
  created_at: "2026-06-16T08:00:00.000Z",
  updated_at: "2026-06-16T08:00:00.000Z",
  closed_at: null,
};

const commentRow = {
  id: "comment1",
  topic_id: "topic1",
  message: "Primer comentario",
  alias_label: "Usuario 1",
  author_id: "user1",
  author_name: "Persona Real",
  author_email: "persona@test.com",
  author_role: "2",
  is_hidden: 0,
  hidden_at: null,
  hidden_by_name: null,
  created_at: "2026-06-16T08:05:00.000Z",
  updated_at: "2026-06-16T08:05:00.000Z",
};

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
  mocks.executeImpl = async (statement) => {
    if (statement.sql.includes("FROM forum_comments c")) {
      return { rows: [commentRow] };
    }
    return { rows: [topicRow], rowsAffected: 1 };
  };
});

describe("GET /forum/topics/[id]", () => {
  test("omits real author identity for non-management users", async () => {
    mocks.sessionResult = {
      success: true,
      user: {
        id: "commercial1",
        role: "2",
        email: "c@test.com",
        name: "Comercial",
      },
    };

    const res = await route.GET(createRequest(), {
      params: Promise.resolve({ id: "topic1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.comments[0]).toMatchObject({
      author_label: "Usuario 1",
      message: "Primer comentario",
    });
    expect(body.data.comments[0]).not.toHaveProperty("author_name");
    expect(body.data.comments[0]).not.toHaveProperty("author_email");
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("c.is_hidden = 0"),
      }),
    );
  });

  test("includes author identity and hidden counts for management users", async () => {
    const res = await route.GET(createRequest(), {
      params: Promise.resolve({ id: "topic1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.comments[0]).toMatchObject({
      author_label: "Usuario 1",
      author_name: "Persona Real",
      author_email: "persona@test.com",
      is_hidden: false,
    });
    expect(body.data.topic.hidden_comments_count).toBe(1);
  });
});

describe("PATCH /forum/topics/[id]", () => {
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

    const res = await route.PATCH(createRequest({ status: "closed" }, "PATCH"), {
      params: Promise.resolve({ id: "topic1" }),
    });

    expect(res.status).toBe(403);
  });
});
