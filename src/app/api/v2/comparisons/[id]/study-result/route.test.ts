import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  validate: vi.fn(), client: vi.fn(), authorize: vi.fn(), get: vi.fn(), confirm: vi.fn(),
  transaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), close: vi.fn(),
}));
vi.mock("@/core/auth/session-utils", () => ({ validateUserSession: mocks.validate }));
vi.mock("@/core/libsql/client", () => ({ getTursoClient: mocks.client }));
vi.mock("@/comparativas/server/study-result", async (original) => ({
  ...await original<typeof import("@/comparativas/server/study-result")>(),
  authorizeStudyResult: mocks.authorize, getStudyResult: mocks.get, confirmStudyResult: mocks.confirm,
}));
import { GET, PATCH } from "./route";
import { StudyResultError } from "@/comparativas/server/study-result";

const response = { success: true, comparisonStatus: "awaiting_review", data: null };
const tx = { execute: vi.fn(), commit: mocks.commit, rollback: mocks.rollback, close: mocks.close };
const db = { transaction: mocks.transaction };
const valid = { resultId: "result", revision: "a".repeat(64), planDecision: "none", commissionDecision: "apply" };
const context = { params: Promise.resolve({ id: "comparison" }) };
function request(method = "GET", body: unknown = valid, query = "") {
  return new NextRequest(`http://localhost/api/v2/comparisons/comparison/study-result${query}`, {
    method, ...(method === "PATCH" ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.validate.mockResolvedValue({ success: true, user: { id: "actor", role: "2" } });
  mocks.client.mockReturnValue(db);
  mocks.transaction.mockResolvedValue(tx);
  mocks.authorize.mockResolvedValue("2");
  mocks.get.mockResolvedValue(response);
  mocks.confirm.mockResolvedValue(response);
});

describe("study result HTTP contract", () => {
  test.each(["GET", "PATCH"])("%s requires session", async (method) => {
    mocks.validate.mockResolvedValue({ success: false });
    const result = await (method === "GET" ? GET : PATCH)(request(method), context);
    expect(result.status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  test("GET snapshots read-only and returns null with polling status", async () => {
    const result = await GET(request(), context);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(response);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(mocks.transaction).toHaveBeenCalledWith("read");
    expect(mocks.get).toHaveBeenCalledWith(tx, "comparison", "actor", undefined);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  test("unknown-type plan preview is forwarded without mutation", async () => {
    expect((await GET(request("GET", undefined, "?plan=indexado"), context)).status).toBe(200);
    expect(mocks.get).toHaveBeenCalledWith(tx, "comparison", "actor", "indexado");
  });
  test.each(["?plan=fija", "?plan=", "?offer=100", "?plan=fijo&user_id=admin"])("invalid query %s rejected", async (query) => {
    expect((await GET(request("GET", undefined, query), context)).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  test.each([{ amount: 2 }, { offer_euros: 2 }, { user_id: "owner" }, { base_percentage: 5 }, { manualSales: 0 }])("PATCH rejects unknown/inapplicable fields %j", async (extra) => {
    expect((await PATCH(request("PATCH", { ...valid, ...extra }), context)).status).toBe(400);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  test("PATCH uses current session actor and transactional service", async () => {
    expect((await PATCH(request("PATCH"), context)).status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith(db, "comparison", "actor");
    expect(mocks.transaction).toHaveBeenCalledWith("write");
    expect(mocks.confirm).toHaveBeenCalledWith(tx, "comparison", "actor", valid);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  test.each([403, 409] as const)("transactional denial %s rolls back", async (status) => {
    mocks.confirm.mockRejectedValue(new StudyResultError(status, "Estudio con IA cambiado"));
    expect((await PATCH(request("PATCH"), context)).status).toBe(status);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  test("denied precheck never opens a write transaction", async () => {
    mocks.authorize.mockRejectedValue(new StudyResultError(403, "Sin permiso"));
    expect((await PATCH(request("PATCH"), context)).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  test("technical transaction error is 500 with safe public message", async () => {
    mocks.confirm.mockRejectedValue(new Error("provider raw financial secret"));
    const result = await PATCH(request("PATCH"), context);
    expect(result.status).toBe(500);
    expect(JSON.stringify(await result.json())).not.toContain("secret");
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
});
