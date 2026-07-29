import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getSubcomerciales: vi.fn(),
  getTursoClient: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));

const route = await import("./route");

const userRows = [
  {
    id: "user-1",
    email: "user@example.com",
    email_verified: 1,
    name: "User",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    image: null,
    role: "2",
    banned: 0,
    ban_reason: null,
    ban_expires: null,
    super_id: null,
    should_reset_password: 0,
    company: null,
    org_id: "organization-1",
    org_name: "Organization",
    org_logo: null,
    last_login: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "subordinate-1",
    email: "subordinate@example.com",
    email_verified: 1,
    name: "Subordinate",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    image: null,
    role: "2",
    banned: 0,
    ban_reason: null,
    ban_expires: null,
    super_id: "user-1",
    should_reset_password: 0,
    company: null,
    org_id: "organization-1",
    org_name: "Organization",
    org_logo: null,
    last_login: null,
  },
];

const client = { execute: mocks.execute };

function request(userId: string, role: string) {
  return new NextRequest(
    `https://tenant.example.com/api/v2/users/${userId}/all?role=${encodeURIComponent(role)}`,
  );
}

function get(userId: string, role: string) {
  return route.GET(request(userId, role), {
    params: Promise.resolve({ id: userId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: {
      id: "user-1",
      role: "2",
      email: "user@example.com",
      name: "User",
    },
  });
  mocks.getTursoClient.mockReturnValue(client);
  mocks.getSubcomerciales.mockResolvedValue({
    success: true,
    ids: ["subordinate-1"],
  });
  mocks.execute.mockResolvedValue({ rows: userRows });
});

describe("GET /api/v2/users/[id]/all", () => {
  test("returns 401 before database access without a valid session", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });
    const nextRequest = request("spoofed-user", "admin");
    const paramsThen = vi.fn(() => {
      throw new Error("Params must not be resolved without a session");
    });

    const response = await route.GET(nextRequest, {
      params: { then: paramsThen } as unknown as Promise<{ id: string }>,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mocks.validateUserSession).toHaveBeenCalledWith(nextRequest);
    expect(paramsThen).not.toHaveBeenCalled();
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.getSubcomerciales).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("rejects a spoofed path user before database access", async () => {
    const response = await get("another-user", "2");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: "Forbidden",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.getSubcomerciales).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("rejects a spoofed query role before database access", async () => {
    const response = await get("user-1", "admin");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: "Forbidden",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.getSubcomerciales).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("limits a role 2 user to self and subordinates", async () => {
    const response = await get("user-1", "2");

    expect(response.status).toBe(200);
    expect(mocks.getSubcomerciales).toHaveBeenCalledWith(client, "user-1");
    expect(mocks.execute).toHaveBeenCalledWith({
      sql: expect.stringContaining("WHERE u.id = ? OR u.id IN (?)"),
      args: ["user-1", "subordinate-1"],
    });
    expect(await response.json()).toEqual({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ id: "user-1" }),
        expect.objectContaining({ id: "subordinate-1" }),
      ]),
    });
  });

  test.each(["admin", "1"])(
    "returns the full listing for role %s",
    async (role) => {
      const privilegedId = `${role}-user`;
      mocks.validateUserSession.mockResolvedValue({
        success: true,
        user: {
          id: privilegedId,
          role,
          email: `${role}@example.com`,
          name: role,
        },
      });

      const response = await get(privilegedId, role);

      expect(response.status).toBe(200);
      expect(mocks.getSubcomerciales).not.toHaveBeenCalled();
      expect(mocks.execute).toHaveBeenCalledWith({
        sql: expect.not.stringContaining("WHERE u.id"),
        args: [],
      });
      expect(await response.json()).toEqual({
        success: true,
        data: expect.any(Array),
      });
    },
  );
});
