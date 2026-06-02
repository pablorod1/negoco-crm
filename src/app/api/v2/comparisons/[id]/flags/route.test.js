import { beforeEach, describe, expect, mock, test } from "bun:test";

let executeImpl;
const execute = mock((statement) => executeImpl(statement));
const getTursoClient = mock(() => ({
  execute,
}));

mock.module("@/core/libsql/client", () => ({
  getTursoClient,
}));

mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "u1", role: "1", email: "bo@test.com", name: "BO" },
  }),
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
  execute.mockClear();
  getTursoClient.mockClear();
  executeImpl = async () => ({ rows: [], rowsAffected: 1 });
});

describe("PATCH /comparisons/[id]/flags", () => {
  test("updates has_permanencia and has_renovacion", async () => {
    const res = await flagsRoute.PATCH(
      FLAGS_REQUEST("c1", { has_permanencia: true, has_renovacion: false }),
      PARAMS("c1"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(execute.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects unauthenticated requests with 401", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { PATCH: freshPATCH } = await import("./route.ts");
    const res = await freshPATCH(
      FLAGS_REQUEST("c1", { has_permanencia: true }),
      PARAMS("c1"),
    );
    expect(res.status).toBe(401);
  });
});
