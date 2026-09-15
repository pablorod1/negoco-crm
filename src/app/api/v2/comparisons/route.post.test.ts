import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  ComparativaDB,
  ComparativaFile,
} from "@/comparativas/types";

type Statement = { sql: string; args?: unknown[] };
type StoredComparison = {
  id: string;
  client: string;
  service: string;
  plan: string;
  comision_fijo: number;
  comision_indexado: number;
  comision_sales_person_fijo: number;
  comision_sales_person_indexado: number;
  notes: string;
  user_id: string;
  creation_date: string;
  status: string;
  tramite_id: string | null;
  company_id: string | null;
};

const mocks = vi.hoisted(() => ({
  validateUserSession: vi.fn(),
  getSubcomerciales: vi.fn(),
  getTursoClient: vi.fn(),
  transaction: vi.fn(),
  txClose: vi.fn(),
  txCommit: vi.fn(),
  txExecute: vi.fn(),
  txRollback: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/auth/session-utils", () => ({ validateUserSession: mocks.validateUserSession }));

vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));

const route = await import("./route");

const comparativa: ComparativaDB = {
  id: "CMP-creation-1",
  client: "Acme",
  service: "Luz",
  plan: ["fijo", "indexado"],
  comision: { fijo: 10, indexado: 20 },
  comision_sales_person: { fijo: 5, indexado: 8 },
  notes: ["Llamar por la tarde"],
  user_id: "user-1",
  creation_date: "2026-07-31T08:00:00.000Z",
  status: "pending",
  tramite_id: undefined,
  has_permanencia: 0,
  has_renovacion: 0,
};

const comparativaFile: ComparativaFile = {
  id: "file-1",
  comparativa_id: comparativa.id,
  filename: "factura.pdf",
  size: 1024,
  extension: "pdf",
  upload_date: "2026-07-31T08:00:01.000Z",
  download_url: "https://storage.example.com/factura.pdf",
  preview_url: "https://storage.example.com/factura-preview.pdf",
};

let comparisons: Map<string, StoredComparison>;
let files: Map<string, ComparativaFile>;
let creationAudits: Set<string>;
let failFileInsert: boolean;
let transactionSnapshot: {
  comparisons: Map<string, StoredComparison>;
  files: Map<string, ComparativaFile>;
  creationAudits: Set<string>;
};

function createRequest(
  comparison: ComparativaDB = comparativa,
  comparisonFiles: ComparativaFile[] = [comparativaFile],
) {
  const formData = new FormData();
  formData.append("comparativa", JSON.stringify(comparison));
  formData.append("files", JSON.stringify(comparisonFiles));

  return new NextRequest(
    "https://tenant.example.com/api/v2/comparisons",
    { method: "POST", body: formData },
  );
}

function comparisonFromArgs(args: unknown[]): StoredComparison {
  return {
    id: String(args[0]),
    client: String(args[1]),
    service: String(args[2]),
    plan: String(args[3]),
    comision_fijo: Number(args[4]),
    comision_indexado: Number(args[5]),
    comision_sales_person_fijo: Number(args[6]),
    comision_sales_person_indexado: Number(args[7]),
    notes: String(args[8]),
    user_id: String(args[9]),
    creation_date: String(args[10]),
    status: String(args[11]),
    tramite_id: args[12] === null ? null : String(args[12]),
    company_id: args[13] === null ? null : String(args[13]),
  };
}

function fileFromArgs(args: unknown[]): ComparativaFile {
  return {
    id: String(args[0]),
    comparativa_id: String(args[1]),
    filename: String(args[2]),
    size: Number(args[3]),
    extension: String(args[4]),
    upload_date: String(args[5]),
    download_url: String(args[6]),
    preview_url: args[7] === null ? null : String(args[7]),
  };
}

async function executeStatement(statement: Statement) {
  const sql = statement.sql.trim();
  const args = statement.args ?? [];

  if (sql.startsWith("SELECT") && sql.includes("FROM comparativas")) {
    const row = comparisons.get(String(args[0]));
    return { rows: row ? [row] : [], rowsAffected: 0 };
  }

  if (sql.startsWith("INSERT INTO comparativas")) {
    const row = comparisonFromArgs(args);
    if (comparisons.has(row.id)) {
      throw new Error("UNIQUE constraint failed: comparativas.id");
    }
    comparisons.set(row.id, row);
    return { rows: [], rowsAffected: 1 };
  }

  if (sql.startsWith("SELECT") && sql.includes("FROM comparativa_files")) {
    const row = files.get(String(args[0]));
    return { rows: row ? [row] : [], rowsAffected: 0 };
  }

  if (sql.startsWith("INSERT INTO comparativa_files")) {
    if (failFileInsert) throw new Error("file insert failed");
    const file = fileFromArgs(args);
    if (files.has(file.id)) {
      throw new Error("UNIQUE constraint failed: comparativa_files.id");
    }
    files.set(file.id, file);
    return { rows: [], rowsAffected: 1 };
  }

  if (sql.startsWith("INSERT INTO comparativa_changes")) {
    const comparativaId = String(args.at(-1) ?? args[1]);
    const inserted = !creationAudits.has(comparativaId);
    creationAudits.add(comparativaId);
    return { rows: [], rowsAffected: inserted ? 1 : 0 };
  }

  throw new Error(`Unexpected SQL in test: ${statement.sql}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role: "admin" } });
  mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
  comparisons = new Map();
  files = new Map();
  creationAudits = new Set();
  failFileInsert = false;
  transactionSnapshot = {
    comparisons: new Map(),
    files: new Map(),
    creationAudits: new Set(),
  };

  mocks.txExecute.mockImplementation(executeStatement);
  mocks.txCommit.mockResolvedValue(undefined);
  mocks.txClose.mockReturnValue(undefined);
  mocks.txRollback.mockImplementation(async () => {
    comparisons = new Map(transactionSnapshot.comparisons);
    files = new Map(transactionSnapshot.files);
    creationAudits = new Set(transactionSnapshot.creationAudits);
  });
  mocks.transaction.mockImplementation(async () => {
    transactionSnapshot = {
      comparisons: new Map(comparisons),
      files: new Map(files),
      creationAudits: new Set(creationAudits),
    };
    return {
      execute: mocks.txExecute,
      commit: mocks.txCommit,
      rollback: mocks.txRollback,
      close: mocks.txClose,
    };
  });
  mocks.getTursoClient.mockReturnValue({
    transaction: mocks.transaction,
  });
});

describe("POST /api/v2/comparisons", () => {
  test("requires a session for creation and list", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });
    expect((await route.POST(createRequest())).status).toBe(401);
    expect((await route.GET(new NextRequest("https://tenant.example.com/api/v2/comparisons"))).status).toBe(401);
  });

  test("rejects role2 manual amounts and completed creation", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role: "2" } });
    expect((await route.POST(createRequest())).status).toBe(403);
    expect((await route.POST(createRequest({ ...comparativa, status: "completed", comision: { fijo: null, indexado: null }, comision_sales_person: { fijo: null, indexado: null } }))).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  test("role2 can create a pending comparison with unassigned commissions and a document only in their scope", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role: "2" } });
    const empty = { ...comparativa, comision: { fijo: null, indexado: null }, comision_sales_person: { fijo: null, indexado: null } };
    expect((await route.POST(createRequest({ ...empty, user_id: "other" }))).status).toBe(403);
    expect((await route.POST(createRequest(empty, []))).status).toBe(400);
    expect((await route.POST(createRequest(empty))).status).toBe(200);
  });

  test.each(["GET", "POST"])("%s ignores spoofed role and redacts agency while preserving completeness", async (method) => {
    mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role: "2" } });
    const execute = vi.fn(async (statement) => ({ rows: statement.sql.includes("COUNT(*)") ? [{ total: 1 }] : [{ id: "comparison-1", plan: '["fijo"]', comision_fijo: 12345, comision_indexado: null, comision_sales_person_fijo: 0, comision_sales_person_indexado: null }] }));
    mocks.getTursoClient.mockReturnValue({ execute });
    const request = new NextRequest("https://tenant.example.com/api/v2/comparisons?user_role=admin&user_id=other", method === "POST" ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ page: 1, rowsPerPage: 10, user_id: "other", user_role: "admin" }) } : undefined);
    const response = await route[method as "GET" | "POST"](request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [{ comision: { fijo: null, indexado: null }, comision_sales_person: { fijo: 0 }, has_complete_commissions: { fijo: true, indexado: false } }] });
    expect(execute.mock.calls.every(([statement]) => statement.args.includes("user-1") && !statement.args.includes("other"))).toBe(true);
  });
  test("list responses preserve null commissions and assigned zero", async () => {
    mocks.getTursoClient.mockReturnValue({ execute: vi.fn(async (statement) => ({ rows: statement.sql.includes("COUNT(*)")
      ? [{ total: 1 }]
      : [{ id: "comparison-null", creation_date: "2026-09-02", client: "Client", service: "Luz", status: "pending", plan: '["fijo"]', comision_fijo: null, comision_indexado: 0, comision_sales_person_fijo: 0, comision_sales_person_indexado: null }],
    })) });
    const response = await route.GET(new NextRequest("https://tenant.example.com/api/v2/comparisons?user_id=user-1&user_role=admin"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [{
      comision: { fijo: null, indexado: 0 },
      comision_sales_person: { fijo: 0, indexado: null },
    }] });
  });

  test("accepts null and explicit zero commissions without changing inserted values", async () => {
    const response = await route.POST(createRequest({
      ...comparativa,
      comision: { fijo: null, indexado: 0 },
      comision_sales_person: { fijo: 0, indexado: null },
    }));
    expect(response.status).toBe(200);
    const insert = mocks.txExecute.mock.calls.find(([statement]) =>
      statement.sql.includes("INSERT INTO comparativas"),
    );
    expect(insert?.[0].args.slice(4, 8)).toEqual([null, 0, 0, null]);
  });

  test("creates the comparison, audit, and files in one write transaction", async () => {
    const response = await route.POST(createRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.transaction).toHaveBeenCalledWith("write");
    expect(mocks.txCommit).toHaveBeenCalledOnce();
    expect(mocks.txRollback).not.toHaveBeenCalled();
    expect(comparisons).toHaveLength(1);
    expect(files).toHaveLength(1);
    expect(creationAudits).toEqual(new Set([comparativa.id]));
  });

  test("returns success when the same completed POST is retried", async () => {
    const firstResponse = await route.POST(createRequest());
    const retryResponse = await route.POST(createRequest());

    expect(firstResponse.status).toBe(200);
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toEqual({ success: true });
    expect(comparisons).toHaveLength(1);
    expect(files).toHaveLength(1);
    expect(creationAudits).toHaveLength(1);
    expect(mocks.txCommit).toHaveBeenCalledTimes(2);
  });

  test("completes files and audit data left by an older partial creation", async () => {
    comparisons.set(
      comparativa.id,
      comparisonFromArgs([
        comparativa.id,
        comparativa.client,
        comparativa.service,
        JSON.stringify(comparativa.plan),
        comparativa.comision.fijo,
        comparativa.comision.indexado,
        comparativa.comision_sales_person.fijo,
        comparativa.comision_sales_person.indexado,
        JSON.stringify(comparativa.notes),
        comparativa.user_id,
        comparativa.creation_date,
        comparativa.status,
        null,
        null,
      ]),
    );

    const response = await route.POST(createRequest());

    expect(response.status).toBe(200);
    expect(files.get(comparativaFile.id)).toEqual(comparativaFile);
    expect(creationAudits).toContain(comparativa.id);
    expect(mocks.txCommit).toHaveBeenCalledOnce();
  });

  test("rejects an existing ID with a different creation identity", async () => {
    comparisons.set(
      comparativa.id,
      comparisonFromArgs([
        comparativa.id,
        comparativa.client,
        comparativa.service,
        JSON.stringify(comparativa.plan),
        comparativa.comision.fijo,
        comparativa.comision.indexado,
        comparativa.comision_sales_person.fijo,
        comparativa.comision_sales_person.indexado,
        JSON.stringify(comparativa.notes),
        "another-user",
        "2026-07-30T08:00:00.000Z",
        comparativa.status,
        null,
        null,
      ]),
    );

    const response = await route.POST(createRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: "Comparison creation conflict",
    });
    expect(mocks.txRollback).toHaveBeenCalledOnce();
    expect(files).toHaveLength(0);
  });

  test("rolls back all writes when a related insert fails", async () => {
    failFileInsert = true;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await route.POST(createRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "No se ha podido crear la comparativa",
    });
    expect(mocks.txRollback).toHaveBeenCalledOnce();
    expect(comparisons).toHaveLength(0);
    expect(files).toHaveLength(0);
    expect(creationAudits).toHaveLength(0);
    consoleError.mockRestore();
  });

  // Una comparativa sin factura no se puede estudiar, y el panel de Abarca
  // acabaría abriendo el comparador sin nada que enviar. El formulario ya lo
  // impide, pero `"[]"` pasaba la comprobación de parámetros que hay arriba.
  test("rechaza una comparativa sin ningún documento", async () => {
    const response = await route.POST(createRequest(comparativa, []));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Debes subir al menos un documento",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("rejects files that reference a different comparison", async () => {
    const response = await route.POST(
      createRequest(comparativa, [
        { ...comparativaFile, comparativa_id: "CMP-another" },
      ]),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Invalid comparison file reference",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
