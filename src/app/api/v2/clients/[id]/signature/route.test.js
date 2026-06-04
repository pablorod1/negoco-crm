import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeImpl: undefined,
  execute: vi.fn((statement) => mocks.executeImpl(statement)),
  getTursoClient: vi.fn(),
  getSubcomerciales: vi.fn(),
  sessionResult: {
    success: true,
    user: { id: "u1", role: "admin", email: "a@b.com", name: "Admin" },
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

const route = await import("./route.ts");

const SIGNATURE_GET_REQUEST = (id) =>
  new Request(`https://x/api/v2/clients/${id}/signature`);

const SIGNATURE_REQUEST = (id, body) =>
  new Request(`https://x/api/v2/clients/${id}/signature`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const PARAMS = (id) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  mocks.execute.mockClear();
  mocks.getTursoClient.mockClear();
  mocks.getSubcomerciales.mockClear();
  mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
  mocks.executeImpl = async () => ({ rows: [], rowsAffected: 1 });
  mocks.sessionResult = {
    success: true,
    user: { id: "u1", role: "admin", email: "a@b.com", name: "Admin" },
  };
});

describe("GET /clients/[id]/signature", () => {
  test("returns 401 unauthenticated", async () => {
    mocks.sessionResult = { success: false };

    const res = await route.GET(SIGNATURE_GET_REQUEST("c1"), PARAMS("c1"));

    expect(res.status).toBe(401);
  });

  test("returns 403 when commercial has no access", async () => {
    mocks.sessionResult = {
      success: true,
      user: { id: "commercial1", role: "2", email: "c@b.com", name: "Comercial" },
    };
    mocks.executeImpl = async (stmt) => {
      if (stmt.sql.includes("FROM clients")) {
        return { rows: [], rowsAffected: 0 };
      }
      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.GET(SIGNATURE_GET_REQUEST("c1"), PARAMS("c1"));

    expect(res.status).toBe(403);
  });
});

describe("PATCH /clients/[id]/signature", () => {
  test("updates client and signer fields", async () => {
    mocks.executeImpl = async (stmt) => {
      if (stmt.sql.includes("FROM clients")) {
        return {
          rows: [{ id: "c1", type: "Empresa", name: "Old Name" }],
          rowsAffected: 0,
        };
      }
      if (stmt.sql.includes("SELECT * FROM signers")) {
        return {
          rows: [{ id: "s1", client_id: "c1", name: "Old Signer" }],
          rowsAffected: 0,
        };
      }
      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.PATCH(
      SIGNATURE_REQUEST("c1", {
        client: { name: "New Name", IBAN: "ES1234" },
        signer: {
          name: "Firmante",
          last_name: "Apellido",
          email: "f@x.com",
          phone: "+34600000000",
          document_number: "12345678X",
        },
      }),
      PARAMS("c1"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mocks.execute.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("updates only client fields when no signer provided", async () => {
    mocks.executeImpl = async (stmt) => {
      if (stmt.sql.includes("FROM clients")) {
        return {
          rows: [{ id: "c1", type: "Particular", name: "Old Name" }],
          rowsAffected: 0,
        };
      }
      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.PATCH(
      SIGNATURE_REQUEST("c1", {
        client: { name: "New Name" },
      }),
      PARAMS("c1"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("creates new signer when none exists for Empresa client", async () => {
    mocks.executeImpl = async (stmt) => {
      if (stmt.sql.includes("FROM clients")) {
        return {
          rows: [{ id: "c1", type: "Empresa", name: "Company" }],
          rowsAffected: 0,
        };
      }
      if (stmt.sql.includes("SELECT * FROM signers")) {
        return { rows: [], rowsAffected: 0 };
      }
      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.PATCH(
      SIGNATURE_REQUEST("c1", {
        signer: {
          name: "New Signer",
          last_name: "Last",
          email: "s@x.com",
          phone: "+34600000000",
          document_number: "12345678X",
        },
      }),
      PARAMS("c1"),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("returns 403 when client is not accessible", async () => {
    mocks.executeImpl = async (stmt) => {
      if (stmt.sql.includes("FROM clients")) {
        return { rows: [], rowsAffected: 0 };
      }
      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.PATCH(
      SIGNATURE_REQUEST("nonexistent", {
        client: { name: "New Name" },
      }),
      PARAMS("nonexistent"),
    );
    expect(res.status).toBe(403);
  });

  test("rejects invalid signer email", async () => {
    mocks.executeImpl = async (stmt) => {
      if (stmt.sql.includes("FROM clients")) {
        return {
          rows: [{ id: "c1", type: "Empresa", name: "Company" }],
          rowsAffected: 0,
        };
      }
      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.PATCH(
      SIGNATURE_REQUEST("c1", {
        signer: {
          name: "Firmante",
          last_name: "Apellido",
          email: "invalid-email",
          phone: "+34600000000",
          document_number: "12345678X",
        },
      }),
      PARAMS("c1"),
    );
    expect(res.status).toBe(400);
  });

  test("returns 403 when commercial has no access", async () => {
    mocks.sessionResult = {
      success: true,
      user: { id: "commercial1", role: "2", email: "c@b.com", name: "Comercial" },
    };
    mocks.executeImpl = async (stmt) => {
      if (stmt.sql.includes("FROM clients")) {
        return { rows: [], rowsAffected: 0 };
      }
      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.PATCH(
      SIGNATURE_REQUEST("c1", { client: { name: "New Name" } }),
      PARAMS("c1"),
    );

    expect(res.status).toBe(403);
  });

  test("returns 400 when signer is sent for Particular", async () => {
    mocks.executeImpl = async (stmt) => {
      if (stmt.sql.includes("FROM clients")) {
        return {
          rows: [{ id: "c1", type: "Particular", name: "Person" }],
          rowsAffected: 0,
        };
      }
      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.PATCH(
      SIGNATURE_REQUEST("c1", {
        signer: {
          name: "Firmante",
          last_name: "Apellido",
          email: "f@x.com",
          phone: "+34600000000",
          document_number: "12345678X",
        },
      }),
      PARAMS("c1"),
    );

    expect(res.status).toBe(400);
  });

  test("rejects unauthenticated requests with 401", async () => {
    mocks.sessionResult = { success: false };
    const res = await route.PATCH(
      SIGNATURE_REQUEST("c1", {}),
      PARAMS("c1"),
    );
    expect(res.status).toBe(401);
  });
});
