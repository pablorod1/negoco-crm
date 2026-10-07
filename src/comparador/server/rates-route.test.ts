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

const { requireRatesAccess } = await import("./rates-route");

const request = () =>
  ({
    headers: { get: (name: string) => (name.toLowerCase() === "host" ? "test.negococloud.es" : null) },
  }) as unknown as NextRequest;

function session(role: string, email = "persona@agencia.es") {
  mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role, email } });
  mocks.getTursoClient.mockReturnValue({
    execute: vi.fn(async () => ({ rows: [{ role, super_id: null }] })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.getTenantModules.mockResolvedValue({ negoco_studies: true });
  // Un comercial con el permiso del comparador concedido a mano.
  mocks.getEffectivePermissions.mockResolvedValue({
    "comparisons.study.complete": true,
    "comparisons.study.negoco": true,
  });
});

describe("requireRatesAccess", () => {
  test("backoffice manages rates but is not Negoco", async () => {
    session("1");
    const result = await requireRatesAccess(request(), { manage: true });
    expect(result.ok && result.context).toMatchObject({ canManage: true, canManageCatalog: false });
  });

  test("commercials can read but not manage", async () => {
    session("2");
    const read = await requireRatesAccess(request(), { manage: false });
    expect(read.ok && read.context.canManage).toBe(false);

    const write = await requireRatesAccess(request(), { manage: true });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.response.status).toBe(403);
  });

  test("Negoco staff are listed by email", async () => {
    vi.stubEnv("COMPARADOR_CATALOG_ADMINS", "pablo@negococloud.es, otra@negococloud.es");
    session("admin", "Pablo@NegocoCloud.es");
    const result = await requireRatesAccess(request(), { manage: true });
    expect(result.ok && result.context.canManageCatalog).toBe(true);
  });

  test("no module, no rates", async () => {
    session("admin");
    mocks.getTenantModules.mockResolvedValue({ negoco_studies: false });
    const result = await requireRatesAccess(request(), { manage: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});
