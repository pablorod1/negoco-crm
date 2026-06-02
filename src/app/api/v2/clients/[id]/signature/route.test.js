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
    user: { id: "u1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const route = await import("./route.ts");

const SIGNATURE_REQUEST = (id, body) =>
  new Request(`https://x/api/v2/clients/${id}/signature`, {
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

describe("PATCH /clients/[id]/signature", () => {
  test("updates client and signer fields", async () => {
    executeImpl = async (stmt) => {
      if (stmt.sql.includes("SELECT * FROM clients")) {
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
    expect(execute.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("updates only client fields when no signer provided", async () => {
    executeImpl = async (stmt) => {
      if (stmt.sql.includes("SELECT * FROM clients")) {
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
    executeImpl = async (stmt) => {
      if (stmt.sql.includes("SELECT * FROM clients")) {
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

  test("returns 404 when client not found", async () => {
    executeImpl = async (stmt) => {
      if (stmt.sql.includes("SELECT * FROM clients")) {
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
    expect(res.status).toBe(404);
  });

  test("rejects invalid signer email", async () => {
    executeImpl = async (stmt) => {
      if (stmt.sql.includes("SELECT * FROM clients")) {
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

  test("rejects unauthenticated requests with 401", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { PATCH: freshPATCH } = await import("./route.ts");
    const res = await freshPATCH(
      SIGNATURE_REQUEST("c1", {}),
      PARAMS("c1"),
    );
    expect(res.status).toBe(401);
  });
});
