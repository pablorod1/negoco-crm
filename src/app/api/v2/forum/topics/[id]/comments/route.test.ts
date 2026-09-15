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
    user: {
      id: "commercial1",
      role: "2",
      email: "c@test.com",
      name: "Comercial",
    },
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

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.sessionResult = {
    success: true,
    user: {
      id: "commercial1",
      role: "2",
      email: "c@test.com",
      name: "Comercial",
    },
  };
});

describe("POST /forum/topics/[id]/comments", () => {
  test("blocks comments on closed topics", async () => {
    mocks.executeImpl = async () => ({
      rows: [{ id: "topic1", status: "closed" }],
      rowsAffected: 1,
    });

    const res = await route.POST(createRequest({ message: "No debería entrar" }), {
      params: Promise.resolve({ id: "topic1" }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Forum topic is closed");
  });
});
