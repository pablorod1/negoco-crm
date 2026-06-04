import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeImpl: undefined,
  execute: vi.fn((statement) => mocks.executeImpl(statement)),
  getTursoClient: vi.fn(),
  sessionResult: {
    success: true,
    user: { id: "u1", role: "1", email: "bo@test.com", name: "BO" },
  },
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

const flagsRoute = await import("./route.ts");

const FLAGS_REQUEST = (id, body) =>
  new Request(`https://beenergy.negococloud.es/api/v2/comparisons/${id}/flags`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const PARAMS = (id) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.executeImpl = async () => ({ rows: [], rowsAffected: 1 });
  mocks.sessionResult = {
    success: true,
    user: { id: "u1", role: "1", email: "bo@test.com", name: "BO" },
  };
});

describe("PATCH /comparisons/[id]/flags", () => {
  test("updates has_permanencia and has_renovacion", async () => {
    const res = await flagsRoute.PATCH(
      FLAGS_REQUEST("c1", { has_permanencia: true, has_renovacion: false }),
      PARAMS("c1"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mocks.execute.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects unauthenticated requests with 401", async () => {
    mocks.sessionResult = { success: false };
    const res = await flagsRoute.PATCH(
      FLAGS_REQUEST("c1", { has_permanencia: true }),
      PARAMS("c1"),
    );
    expect(res.status).toBe(401);
  });
});
