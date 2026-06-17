import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  clientExecute: vi.fn(),
  getTursoClient: vi.fn(),
  transaction: vi.fn(),
  txCommit: vi.fn(),
  txExecute: vi.fn(),
  txRollback: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));

vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: vi.fn(),
}));

vi.mock("@/tramites/utils/tramiteChangesHelpers", () => ({
  recordTramiteCreation: vi.fn().mockResolvedValue(undefined),
}));

const originalGeocodeKey = process.env.GEOCODE_API_KEY;

const createFormData = (clientEmail: unknown, signerEmail: unknown) => {
  const formData = new FormData();

  formData.append(
    "tramite",
    JSON.stringify({
      id: "TR-1",
      creation_date: "2026-06-16T10:00:00.000Z",
      sales_name: "Ana Comercial",
      status: "Borrador",
      liquidez_status: null,
      notes: [],
      internal_notes: [],
      client_id: "",
      user_id: "USER-1",
      provider: null,
      plan: null,
    }),
  );

  formData.append(
    "client",
    JSON.stringify({
      id: "CLI-1",
      name: "Acme",
      last_name: "",
      email: clientEmail,
      type: "Empresa",
      phone: "600000000",
      address: "Calle Mayor 1",
      postal_code: "28001",
      province: "Madrid",
      city: "Madrid",
      document_type: "CIF",
      document_number: "B12345678",
      IBAN: "ES0000000000000000000000",
      coordinates: null,
    }),
  );

  formData.append("contracts", JSON.stringify([]));
  formData.append(
    "signer",
    JSON.stringify({
      id: "SGN-1",
      name: "Ana",
      last_name: "Garcia",
      email: signerEmail,
      phone: "611111111",
      document_number: "12345678Z",
      cargo: null,
      client_id: "",
    }),
  );
  formData.append(
    "userData",
    JSON.stringify({
      id: "USER-1",
      name: "Ana Comercial",
      email: "ana@crm.test",
      role: "admin",
      image: null,
    }),
  );

  return formData;
};

const createRequest = (formData: FormData) =>
  ({
    formData: async () => formData,
  }) as NextRequest;

describe("POST /api/v2/contracts email handling", () => {
  beforeAll(() => {
    process.env.GEOCODE_API_KEY = "";
  });

  afterAll(() => {
    if (originalGeocodeKey === undefined) {
      delete process.env.GEOCODE_API_KEY;
    } else {
      process.env.GEOCODE_API_KEY = originalGeocodeKey;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.txExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });
    mocks.txCommit.mockResolvedValue(undefined);
    mocks.txRollback.mockResolvedValue(undefined);
    mocks.transaction.mockResolvedValue({
      execute: mocks.txExecute,
      commit: mocks.txCommit,
      rollback: mocks.txRollback,
    });
    mocks.getTursoClient.mockReturnValue({
      execute: mocks.clientExecute,
      transaction: mocks.transaction,
    });
  });

  test("normalizes empty and null client/signer emails to empty strings", async () => {
    const response = await POST(createRequest(createFormData("", null)));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const clientInsertCall = mocks.txExecute.mock.calls.find(([statement]) =>
      String(statement.sql).includes("INSERT INTO clients"),
    );
    const signerInsertCall = mocks.txExecute.mock.calls.find(([statement]) =>
      String(statement.sql).includes("INSERT INTO signers"),
    );

    const clientInsert = clientInsertCall?.[0] as
      | { sql: string; args: unknown[] }
      | undefined;
    const signerInsert = signerInsertCall?.[0] as
      | { sql: string; args: unknown[] }
      | undefined;

    expect(clientInsert?.args[3]).toBe("");
    expect(signerInsert?.args[3]).toBe("");
  });

  test("rejects non-empty invalid email values", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await POST(
      createRequest(createFormData("not-an-email", "firmante@crm.test")),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "Invalid data format",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
