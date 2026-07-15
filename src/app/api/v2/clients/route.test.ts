import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  addClient: vi.fn(),
  execute: vi.fn(),
  getSubcomerciales: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: () => ({
    execute: mocks.execute,
  }),
}));

vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
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

describe("GET /api/v2/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
    mocks.execute.mockImplementation(
      async (statement: { sql: string; args: unknown[] }) => {
        if (statement.sql.includes("COUNT(*) AS total")) {
          return { rows: [{ total: 73 }] };
        }

        return {
          rows: [
            {
              id: "CLI-1",
              name: "Acme",
              last_name: "",
              document_number: "B12345678",
            },
          ],
        };
      },
    );
  });

  test("returns a lightweight paginated collection", async () => {
    const request = new NextRequest(
      "http://localhost/api/v2/clients?id=USR-1&role=1&page=2&limit=50&search=acme",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagination).toEqual({
      page: 2,
      limit: 50,
      total: 73,
      pages: 2,
      hasMore: false,
    });

    const statements = mocks.execute.mock.calls.map(([statement]) => statement);
    const dataStatement = statements.find(({ sql }) =>
      sql.includes("ORDER BY clients.name"),
    );
    expect(dataStatement.args.slice(-2)).toEqual([50, 50]);
    expect(dataStatement.sql).not.toContain("COUNT(DISTINCT");
    expect(dataStatement.sql).not.toContain("tramite_files");
  });

  test("rejects limits above the interactive maximum", async () => {
    const request = new NextRequest(
      "http://localhost/api/v2/clients?id=USR-1&role=1&limit=51",
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("uses an indexed existence check for commercial visibility", async () => {
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["USR-2"],
    });
    const request = new NextRequest(
      "http://localhost/api/v2/clients?id=USR-1&role=2",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    const statements = mocks.execute.mock.calls.map(([statement]) => statement);
    const dataStatement = statements.find(({ sql }) =>
      sql.includes("ORDER BY clients.name"),
    );
    expect(dataStatement.sql).toContain("EXISTS");
    expect(dataStatement.args.slice(0, 2)).toEqual(["USR-1", "USR-2"]);
  });
});
