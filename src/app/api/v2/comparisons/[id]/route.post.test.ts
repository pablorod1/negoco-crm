import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteFolderFromStorage: vi.fn(),
  execute: vi.fn(),
  getSubcomerciales: vi.fn(),
  getTursoClient: vi.fn(),
  parseAbarcaApoloSipsSummary: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));
vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));
vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: mocks.getSubcomerciales,
}));
vi.mock("@/comparativas/utils/comparativaChangesHelpers", () => ({
  createComparativaChange: vi.fn(),
}));
vi.mock("@/core/firebase/data/deleteFolder", () => ({
  deleteFolderFromStorage: mocks.deleteFolderFromStorage,
}));
vi.mock("@/comparativas/utils/abarca-apolo-sips", () => ({
  parseAbarcaApoloSipsSummary: mocks.parseAbarcaApoloSipsSummary,
}));

const route = await import("./route");

const comparisonRow = {
  id: "comparison-1",
  client: "Client",
  service: "Luz",
  plan: JSON.stringify(["fijo"]),
  status: "completed",
  comision_fijo: 10,
  comision_indexado: 20,
  comision_sales_person_fijo: 5,
  comision_sales_person_indexado: 10,
  notes: JSON.stringify([]),
  creation_date: "2026-01-01T00:00:00.000Z",
  tramite_id: null,
  company_id: null,
  has_permanencia: 0,
  has_renovacion: 0,
  user_id: "owner-1",
  email: "owner@example.com",
  name: "Owner",
  image: null,
};

/** Body con identidad falsificada: el endpoint debe ignorarlo por completo. */
const spoofedBody = {
  id: "another-comparison",
  user_id: "",
  user_role: "admin",
};

function post(
  body: unknown = spoofedBody,
  comparisonId = "comparison-1",
) {
  const request = new NextRequest(
    `https://tenant.example.com/api/v2/comparisons/${comparisonId}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  return route.POST(request, {
    params: Promise.resolve({ id: comparisonId }),
  });
}

function del(comparisonId = "comparison-1") {
  const request = new NextRequest(
    `https://tenant.example.com/api/v2/comparisons/${comparisonId}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organization_id: "org-1" }),
    },
  );

  return route.DELETE(request, {
    params: Promise.resolve({ id: comparisonId }),
  });
}

function comparisonSelects() {
  return mocks.execute.mock.calls
    .map(([statement]) => statement as { sql: string; args: unknown[] })
    .filter((statement) => statement.sql.includes("FROM comparativas c"));
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.validateUserSession.mockResolvedValue({
    success: true,
    user: {
      id: "user-1",
      role: "1",
      email: "user@example.com",
      name: "User",
    },
  });
  mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
  mocks.getSubcomerciales.mockResolvedValue({ success: true, ids: [] });
  mocks.deleteFolderFromStorage.mockResolvedValue({ success: true });
  mocks.execute.mockImplementation(
    async (statement: { sql: string; args: unknown[] }) => {
      if (statement.sql.includes("FROM comparativas c")) {
        return { rows: [comparisonRow] };
      }
      if (statement.sql.includes("comparison_exists")) {
        return { rows: [{ comparison_exists: 1, file_count: 0 }] };
      }
      if (statement.sql.includes("FROM comparativa_files")) {
        return { rows: [] };
      }
      if (statement.sql.includes("FROM abarca_estudios")) {
        return { rows: [] };
      }
      if (statement.sql.includes("DELETE FROM comparativas")) {
        return { rows: [], rowsAffected: 1 };
      }
      throw new Error(`Unexpected SQL in test: ${statement.sql}`);
    },
  );
});

describe("POST /api/v2/comparisons/[id]", () => {
  test.each(["2", "1", "admin"])("protects financial payload for role %s without losing document status", async (role) => {
    mocks.validateUserSession.mockResolvedValue({ success: true, user: { id: "user-1", role } });
    const document = { field: "comparativa_pdf", status: "missing", reason: "Pendiente" };
    const raw = JSON.stringify({ oferta_euros: 87654, abarca_documents: [document] });
    mocks.parseAbarcaApoloSipsSummary.mockReturnValue({ source: "apolo", has_data: true });
    mocks.execute.mockImplementation(async ({ sql }: { sql: string }) => ({ rows:
      sql.includes("FROM comparativas c") ? [comparisonRow] : sql.includes("FROM abarca_estudios") ? [{ id: "study", raw_payload: raw, crm_id: 98765 }] : [] }));
    const response = await post();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.has_complete_commissions).toEqual({ fijo: true, indexado: true });
    expect(body.data.abarca_estudio.apolo_sips).toEqual({ source: "apolo", has_data: true });
    expect(body.data.abarca_documents).toEqual([document]);
    if (role === "2") {
      expect(body.data.comision).toEqual({ fijo: null, indexado: null });
      expect(body.data.abarca_estudio).toMatchObject({ raw_payload: "", crm_id: null, comisiones: null });
      expect(JSON.stringify(body)).not.toContain("87654");
      expect(JSON.stringify(body)).not.toContain("98765");
    } else {
      expect(body.data.comision).toEqual({ fijo: 10, indexado: 20 });
      expect(body.data.abarca_estudio.raw_payload).toBe(raw);
    }
  });
  test("preserves unassigned null and explicit zero in the detail response", async () => {
    const originalExecute = mocks.execute.getMockImplementation()!;
    mocks.execute.mockImplementation((statement) => statement.sql.includes("FROM comparativas c")
      ? Promise.resolve({ rows: [{ ...comparisonRow, comision_fijo: null, comision_indexado: 0, comision_sales_person_fijo: 0, comision_sales_person_indexado: null }] })
      : originalExecute(statement));
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: {
      comision: { fijo: null, indexado: 0 },
      comision_sales_person: { fijo: 0, indexado: null },
    } });
  });

  test("returns 401 without a session and never opens the database", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await post();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
  });

  test("reads the comparison using the session identity, ignoring the body", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { id: "comparison-1", status: "completed" },
    });

    const [selectStatement] = comparisonSelects();
    expect(selectStatement.args).toEqual(["comparison-1"]);
    expect(selectStatement.sql).not.toContain("u.id IN");
  });

  test("keeps commercial scoping even when the body claims an admin role", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "user-2",
        role: "2",
        email: "commercial@example.com",
        name: "Commercial",
      },
    });
    mocks.getSubcomerciales.mockResolvedValue({
      success: true,
      ids: ["user-3"],
    });

    const response = await post();

    expect(response.status).toBe(200);
    expect(mocks.getSubcomerciales).toHaveBeenCalledWith(
      expect.anything(),
      "user-2",
    );

    const [selectStatement] = comparisonSelects();
    expect(selectStatement.sql).toContain("u.id IN (?, ?)");
    expect(selectStatement.args).toEqual([
      "comparison-1",
      "user-2",
      "user-3",
    ]);
  });

  test("returns 404 for roles outside the comparison hierarchy", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "user-9",
        role: "9",
        email: "other@example.com",
        name: "Other",
      },
    });

    const response = await post();

    expect(response.status).toBe(404);
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
  });

  test("rejects unsafe comparison ids with 400", async () => {
    const response = await post(spoofedBody, "../secrets");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Invalid parameters",
    });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v2/comparisons/[id]", () => {
  test("returns 401 without a session", async () => {
    mocks.validateUserSession.mockResolvedValue({ success: false });

    const response = await del();

    expect(response.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.deleteFolderFromStorage).not.toHaveBeenCalled();
  });

  test("rejects non-admin roles with 403 and deletes nothing", async () => {
    const response = await del();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.deleteFolderFromStorage).not.toHaveBeenCalled();
  });

  test("deletes the comparison and its storage folder for admins", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "admin-1",
        role: "admin",
        email: "admin@example.com",
        name: "Admin",
      },
    });

    const response = await del();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.deleteFolderFromStorage).toHaveBeenCalledWith(
      "comparativas",
      "comparison-1",
      "org-1",
    );
  });
});
