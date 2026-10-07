import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  validateUserSession: vi.fn(),
  getTursoClient: vi.fn(),
  getTenantModules: vi.fn(),
  getEffectivePermissions: vi.fn(),
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/modules/server", () => ({
  getTenantModules: mocks.getTenantModules,
}));
vi.mock("@/core/access-control/server", () => ({
  getEffectivePermissions: mocks.getEffectivePermissions,
}));

const { GET } = await import("./route");

// NextRequest descarta la cabecera host; en producción la pone Next.
const request = (host = "test.negococloud.es") =>
  ({
    headers: {
      get: (name: string) => (name.toLowerCase() === "host" ? host : null),
    },
  }) as unknown as NextRequest;

function userRow(row: Record<string, unknown> | undefined) {
  mocks.getTursoClient.mockReturnValue({
    execute: vi.fn(async () => ({ rows: row ? [row] : [] })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: { id: "user-1", role: "1" },
  });
  mocks.getTenantModules.mockResolvedValue({ negoco_studies: true });
  mocks.getEffectivePermissions.mockResolvedValue({
    "comparisons.study.complete": true,
    "comparisons.study.review": true,
    "comparisons.study.negoco": true,
  });
  userRow({ role: "1", super_id: null });
});

describe("GET /api/v2/comparador/status", () => {
  test("allows a backoffice user in a tenant with the module", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { enabled: true },
    });
    expect(mocks.getTenantModules).toHaveBeenCalledWith("test");
  });

  test("requires a session", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    expect((await GET(request())).status).toBe(401);
    expect(mocks.getTenantModules).not.toHaveBeenCalled();
  });

  test("rejects tenants without the module before touching the tenant database", async () => {
    mocks.getTenantModules.mockResolvedValue({ negoco_studies: false });

    expect((await GET(request("beenergy.negococloud.es"))).status).toBe(403);
    expect(mocks.getTenantModules).toHaveBeenCalledWith("beenergy");
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
  });

  test("rejects a subcomercial even with every permission", async () => {
    userRow({ role: "2", super_id: "boss-1" });

    expect((await GET(request())).status).toBe(403);
  });

  test("rejects a user whose permission was turned off", async () => {
    mocks.getEffectivePermissions.mockResolvedValue({
      "comparisons.study.complete": true,
      "comparisons.study.review": true,
      "comparisons.study.negoco": false,
    });

    expect((await GET(request())).status).toBe(403);
  });

  test("uses the role stored in the database, not the session one", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: { id: "user-1", role: "admin" },
    });
    userRow({ role: "2", super_id: null });
    mocks.getEffectivePermissions.mockResolvedValue({
      "comparisons.study.complete": false,
      "comparisons.study.review": false,
      "comparisons.study.negoco": false,
    });

    expect((await GET(request())).status).toBe(403);
    expect(mocks.getEffectivePermissions).toHaveBeenCalledWith(
      expect.anything(),
      { id: "user-1", role: "2" },
    );
  });
});
