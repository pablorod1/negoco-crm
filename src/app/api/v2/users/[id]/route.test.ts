import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getTursoClient: vi.fn(),
  getEffectivePermissions: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("/src/core/libsql/client.ts", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/access-control/server", () => ({
  getEffectivePermissions: mocks.getEffectivePermissions,
}));
vi.mock("/src/core/access-control/server.ts", () => ({
  getEffectivePermissions: mocks.getEffectivePermissions,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("/src/core/auth/session-utils.ts", () => ({
  validateUserSession: mocks.validateUserSession,
}));

const route = await import("./route");

const permissions = {
  "comparisons.study.complete": false,
  "comparisons.study.review": true,
};

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.execute.mockImplementation(({ sql }: { sql: string }) => {
    if (sql.includes("FROM user u")) {
      return {
        rows: [
          {
            id: "user-1",
            email: "user@example.com",
            email_verified: 1,
            name: "User",
            created_at: "2026-01-01",
            updated_at: "2026-01-02",
            banned: 0,
            image: null,
            role: "2",
            super_id: null,
            should_reset_password: 0,
            notifications: 0,
            company: null,
            org_id: "org-1",
            org_name: "Organization",
            org_logo: null,
            org_metadata: null,
            org_plan: "plan-1",
            org_abarca_user_id: 123,
            plan_name: "premium",
          },
        ],
        rowsAffected: 0,
      };
    }

    return { rows: [], rowsAffected: 0 };
  });
  mocks.getTursoClient.mockReset();
  mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
  mocks.getEffectivePermissions.mockReset();
  mocks.getEffectivePermissions.mockResolvedValue(permissions);
  mocks.validateUserSession.mockReset();
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: {
      id: "viewer-1",
      role: "2",
      email: "viewer@example.com",
      name: "Viewer",
    },
  });
});

describe("GET /api/v2/users/[id]", () => {
  test.each([
    ["GET", route.GET],
    ["POST", route.POST],
  ])("returns 401 before database access for unauthenticated %s", async (
    _method,
    handler,
  ) => {
    mocks.validateUserSession.mockResolvedValue({ success: false });
    const request = new Request(
      "https://tenant.example.com/api/v2/users/user-1",
      { headers: { host: "tenant.example.com" } },
    ) as NextRequest;

    const response = await handler(request, {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("includes the requested user's effective permissions", async () => {
    const request = new Request("https://tenant.example.com/api/v2/users/user-1", {
      headers: { host: "tenant.example.com" },
    }) as NextRequest;

    const response = await route.GET(request, {
      params: Promise.resolve({ id: "user-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.validateUserSession).toHaveBeenCalledWith(request);
    expect(mocks.getEffectivePermissions).toHaveBeenCalledWith(
      expect.objectContaining({ execute: mocks.execute }),
      { id: "user-1", role: "2" },
    );
    expect(body.data.permissions).toStrictEqual({
      "comparisons.study.complete": false,
      "comparisons.study.review": true,
    });
  });
});
