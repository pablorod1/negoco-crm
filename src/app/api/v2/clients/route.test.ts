import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

const mocks = vi.hoisted(() => ({
  addClient: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: () => ({
    execute: mocks.execute,
  }),
}));

vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: vi.fn(),
}));

vi.mock("@/tramites/utils/addTramiteHelpers", () => ({
  addClient: mocks.addClient,
}));

describe("PUT /api/v2/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addClient.mockResolvedValue({ success: true });
    mocks.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });
  });

  test("inserts signer with matching columns and values", async () => {
    const request = {
      json: async () => ({
        client: {
          id: "CLI-1",
          name: "Acme",
          last_name: "",
          email: "contacto@acme.test",
          phone: "600000000",
          address: "Calle Mayor 1",
          document_number: "B12345678",
          document_type: "CIF",
          type: "Empresa",
          IBAN: "ES0000000000000000000000",
          postal_code: "28001",
          province: "Madrid",
          city: "Madrid",
        },
        signer: {
          name: "Ana",
          last_name: "Garcia",
          email: "ana@acme.test",
          phone: "611111111",
          document_number: "12345678Z",
        },
      }),
    } as NextRequest;

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);

    const signerCall = mocks.execute.mock.calls.find(([statement]) =>
      String(statement.sql).includes("INSERT INTO signers"),
    );
    const signerStatement = signerCall?.[0] as
      | { sql: string; args: unknown[] }
      | undefined;

    expect(signerStatement).toBeDefined();
    expect(signerStatement?.sql).toContain(
      "id, name, last_name, email, phone, document_number, cargo, client_id",
    );
    expect(signerStatement?.args).toHaveLength(8);
    expect(signerStatement?.args[6]).toBeNull();
    expect(signerStatement?.args[7]).toBe("CLI-1");
  });
});
