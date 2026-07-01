import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeImpl: undefined,
  execute: vi.fn((statement) => mocks.executeImpl(statement)),
  getTursoClient: vi.fn(),
  getSubcomerciales: vi.fn(),
  updateClient: vi.fn(),
  sessionResult: {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  },
}));

mocks.getTursoClient.mockImplementation(() => ({ execute: mocks.execute }));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("/src/core/libsql/client.ts", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));
vi.mock("/src/core/libsql/users/getSubcomerciales.ts", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));
vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: () => mocks.sessionResult,
}));
vi.mock("/src/core/auth/session-utils.ts", () => ({
  validateUserSession: () => mocks.sessionResult,
}));
vi.mock("@/tramites/utils/updateTramiteHelpers", () => ({
  updateClient: mocks.updateClient,
}));
vi.mock("/src/tramites/utils/updateTramiteHelpers.ts", () => ({
  updateClient: mocks.updateClient,
}));

const route = await import("./route.ts");

const baseClient = {
  id: "c1",
  name: "Client",
  last_name: "One",
  email: "client@example.com",
  type: "Particular",
  phone: "+34600000000",
  address: "Calle Mayor 1",
  postal_code: "28001",
  province: "Madrid",
  city: "Madrid",
  document_type: "DNI",
  document_number: "12345678X",
  IBAN: "ES9121000418450200051332",
};

const normalizedBaseClient = {
  ...baseClient,
  phone_prefix: "34",
};

const CLIENT_REQUEST = (client = baseClient) =>
  new Request("https://x/api/v2/clients/c1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client, user_id: "admin1" }),
  });

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.getSubcomerciales.mockClear();
  mocks.updateClient.mockClear();
  mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
  mocks.updateClient.mockResolvedValue({ success: true });
  mocks.executeImpl = async () => ({ rows: [], rowsAffected: 1 });
  mocks.sessionResult = {
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  };
});

describe("PATCH /clients/[id]", () => {
  test("updates client for admin users", async () => {
    const res = await route.PATCH(CLIENT_REQUEST());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mocks.updateClient).toHaveBeenCalledWith(
      normalizedBaseClient,
      "c1",
      expect.objectContaining({ execute: mocks.execute }),
    );
  });

  test("returns 401 unauthenticated", async () => {
    mocks.sessionResult = { success: false };

    const res = await route.PATCH(CLIENT_REQUEST());

    expect(res.status).toBe(401);
    expect(mocks.updateClient).not.toHaveBeenCalled();
  });

  test("returns 403 for commercial without access", async () => {
    mocks.sessionResult = {
      success: true,
      user: { id: "commercial1", role: "2", email: "c@b.com", name: "Comercial" },
    };
    mocks.executeImpl = async () => ({ rows: [], rowsAffected: 0 });

    const res = await route.PATCH(CLIENT_REQUEST());

    expect(res.status).toBe(403);
    expect(mocks.updateClient).not.toHaveBeenCalled();
  });
});
