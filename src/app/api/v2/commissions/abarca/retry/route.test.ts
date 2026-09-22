import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  enqueueCommissionSyncStatements: vi.fn(),
  execute: vi.fn(),
  getTursoClient: vi.fn(),
  synchronizeCommissionUser: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/integrations/abarca/commissions/sync-state", () => ({
  enqueueCommissionSyncStatements: mocks.enqueueCommissionSyncStatements,
}));
vi.mock("@/integrations/abarca/commissions/sync", () => ({
  synchronizeCommissionUser: mocks.synchronizeCommissionUser,
}));

const route = await import("./route");

function request(body: unknown) {
  return new NextRequest("https://tenant.example.com/api/v2/commissions/abarca/retry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: { id: "admin-1", role: "admin" },
  });
  mocks.getTursoClient.mockReturnValue({
    batch: mocks.batch,
    execute: mocks.execute,
  });
  mocks.enqueueCommissionSyncStatements.mockReturnValue([
    { sql: "enqueue", args: ["user-1"] },
  ]);
  mocks.execute.mockResolvedValue({
    rows: [{ user_id: "user-1", desired_revision: 2, status: "pending" }],
  });
  mocks.synchronizeCommissionUser.mockResolvedValue("synced");
});

describe("POST /api/v2/commissions/abarca/retry", () => {
  test("synchronizes only after an explicit admin request", async () => {
    const response = await route.POST(request({ user_id: "user-1" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { outcome: "synced" },
    });
    expect(mocks.batch).toHaveBeenCalledWith(
      [{ sql: "enqueue", args: ["user-1"] }],
      "write",
    );
    expect(mocks.synchronizeCommissionUser).toHaveBeenCalledWith(
      expect.objectContaining({ execute: mocks.execute }),
      expect.objectContaining({ user_id: "user-1" }),
    );
  });

  test("does not access the database for a non-admin user", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { id: "user-1", role: "1" },
    });

    const response = await route.POST(request({ user_id: "user-1" }));

    expect(response.status).toBe(403);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.synchronizeCommissionUser).not.toHaveBeenCalled();
  });
});
