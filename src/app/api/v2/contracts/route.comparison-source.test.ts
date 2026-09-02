import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), db: vi.fn(), execute: vi.fn(), txExecute: vi.fn(), transaction: vi.fn(),
  commit: vi.fn(), rollback: vi.fn(), subordinates: vi.fn(), processing: vi.fn(), settings: vi.fn(),
}));
vi.mock("@/core/auth/session-utils", () => ({ validateUserSession: mocks.auth }));
vi.mock("@/core/libsql/client", () => ({ getTursoClient: mocks.db }));
vi.mock("@/core/libsql/users/getSubcomerciales", () => ({ getSubcomerciales: mocks.subordinates }));
vi.mock("@/crm-settings/server", () => ({ getCrmSettings: mocks.settings, isProviderAllowed: () => true }));
vi.mock("@/crm-settings/processing-jobs", () => ({ createProcessingJobFromRequest: mocks.processing, cancelPendingProcessingJobsFromRequest: vi.fn() }));
vi.mock("@/tramites/utils/tramiteChangesHelpers", () => ({ recordTramiteCreation: vi.fn() }));

let comparison: Record<string, unknown>;
let txComparison: Record<string, unknown>;
let role: string;
let txRole: string;
let failInsert: boolean;
type Statement = { sql: string; args: unknown[] };

function request(overrides: Record<string, unknown> = {}, sourceId = "comparison-1") {
  const form = new FormData();
  form.set("source_comparison_id", sourceId);
  form.set("tramite", JSON.stringify({ id: "TR-1", creation_date: "2026-09-02", sales_name: "Fake", user_id: "fake-owner", comision: 999999, comision_sales_person: 999998, status: "Borrador", liquidez_status: null, client_id: "CLI-1", plan: "fijo", ...overrides }));
  form.set("client", JSON.stringify({ id: "CLI-1", name: "Client", last_name: "", type: "Particular", email: "", phone: "600000000", address: "Calle Mayor 1", postal_code: "28001", province: "Madrid", city: "Madrid", document_type: "DNI", document_number: "12345678Z", IBAN: "ES0000000000000000000000", coordinates: null }));
  form.set("userData", JSON.stringify({ id: "fake-owner", name: "Fake", email: "fake@example.com", role: "admin" }));
  return new NextRequest("https://tenant.example.com/api/v2/contracts", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  role = txRole = "2";
  failInsert = false;
  comparison = { id: "comparison-1", status: "completed", plan: '["fijo"]', user_id: "owner", owner_name: "Actual Owner", comision_fijo: 123, comision_sales_person_fijo: 45, comision_indexado: null, comision_sales_person_indexado: null };
  txComparison = { ...comparison };
  mocks.auth.mockResolvedValue({ success: true, user: { id: "actor", role: "2", name: "Actor", email: "actor@example.com" } });
  mocks.subordinates.mockResolvedValue({ success: true, ids: ["owner"] });
  mocks.settings.mockResolvedValue({ providers: [], processing_auto_activation: { enabled: false } });
  mocks.execute.mockImplementation(async ({ sql }: Statement) => ({ rows: sql.includes("SELECT role") ? [{ role }] : [comparison] }));
  mocks.txExecute.mockImplementation(async ({ sql }: Statement) => {
    if (sql.includes("SELECT role")) return { rows: [{ role: txRole }] };
    if (sql.includes("FROM comparativas c")) return { rows: [txComparison] };
    if (failInsert && sql.includes("INSERT INTO tramites")) throw new Error("sensitive SQL values 123 and 45");
    return { rows: [], rowsAffected: 1 };
  });
  mocks.transaction.mockResolvedValue({ execute: mocks.txExecute, commit: mocks.commit, rollback: mocks.rollback });
  mocks.db.mockReturnValue({ execute: mocks.execute, transaction: mocks.transaction });
});

describe("comparison contract source", () => {
  test("preserves Baja negative commissions using server amounts", async () => {
    role = txRole = "admin";
    expect((await POST(request({ status: "Baja" }))).status).toBe(200);
    const insert = mocks.txExecute.mock.calls.find(([statement]) => statement.sql.includes("INSERT INTO tramites"))?.[0];
    expect(insert.args).toEqual(expect.arrayContaining([-123, -45]));
  });
  test.each(["Activo", "Baja", "Procesando"])("role2 cannot forge source contract status %s", async (status) => {
    expect((await POST(request({ status }))).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  test("ignores browser identity and money and copies latest amounts in the creation transaction", async () => {
    txComparison.comision_fijo = 456;
    txComparison.comision_sales_person_fijo = 78;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const insert = mocks.txExecute.mock.calls.find(([statement]) => statement.sql.includes("INSERT INTO tramites"))?.[0];
    expect(insert.args).toEqual(expect.arrayContaining([456, 78, "owner", "Actual Owner"]));
    expect(insert.args).not.toEqual(expect.arrayContaining([999999, 999998]));
    expect(mocks.transaction).toHaveBeenCalledWith("write");
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  test("accepts assigned zero and omitted browser money", async () => {
    comparison.comision_fijo = txComparison.comision_fijo = 0;
    comparison.comision_sales_person_fijo = txComparison.comision_sales_person_fijo = 0;
    expect((await POST(request({ comision: undefined, comision_sales_person: undefined }))).status).toBe(200);
    const insert = mocks.txExecute.mock.calls.find(([statement]) => statement.sql.includes("INSERT INTO tramites"))?.[0];
    expect(insert.args.filter((value: unknown) => value === 0).length).toBeGreaterThanOrEqual(2);
  });

  test.each([
    ["missing agency", { comision_fijo: null }], ["missing sales", { comision_sales_person_fijo: null }],
    ["infinite agency", { comision_fijo: Infinity }], ["inactive plan", { plan: '["indexado"]' }],
    ["pending", { status: "pending" }],
  ])("rejects %s before side effects", async (_name, patch) => {
    Object.assign(comparison, patch);
    expect((await POST(request({ status: "Procesando" }))).status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.processing).not.toHaveBeenCalled();
  });

  test("denies spoofed admin scope", async () => {
    mocks.subordinates.mockResolvedValue({ success: true, ids: [] });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  test("requires authentication", async () => {
    mocks.auth.mockResolvedValue({ success: false });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  test("rejects invalid source id and plan", async () => {
    expect((await POST(request({}, "../bad"))).status).toBe(400);
    expect((await POST(request({ plan: "other" }))).status).toBe(400);
  });
  test("returns 404 for a missing comparison", async () => {
    mocks.execute.mockImplementation(async ({ sql }: Statement) => ({ rows: sql.includes("SELECT role") ? [{ role }] : [] }));
    expect((await POST(request())).status).toBe(404);
  });
  test.each([
    ["owner", { user_id: "another" }], ["null amount", { comision_fijo: null }], ["inactive plan", { plan: '["indexado"]' }], ["status", { status: "processed" }],
  ])("rechecks %s and rolls back without writes", async (_name, patch) => {
    Object.assign(txComparison, patch);
    const response = await POST(request());
    expect([403, 409]).toContain(response.status);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.txExecute.mock.calls.some(([statement]) => statement.sql.includes("INSERT"))).toBe(false);
  });
  test("rechecks current role after administrator access is revoked", async () => {
    role = "admin";
    txRole = "2";
    mocks.subordinates.mockResolvedValue({ success: true, ids: [] });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  test("rejects an owner change even when both owners remain in scope", async () => {
    mocks.subordinates.mockResolvedValue({ success: true, ids: ["owner", "another"] });
    txComparison.user_id = "another";
    expect((await POST(request())).status).toBe(409);
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  test("rolls back an insert failure without exposing copied values", async () => {
    failInsert = true;
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "Error al agregar trámite" });
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
