import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  deleteObject: vi.fn(),
  execute: vi.fn(),
  getTursoClient: vi.fn(),
  listAll: vi.fn(),
  ref: vi.fn(),
  validateUserSession: vi.fn(),
}));

vi.mock("@/core/auth/session-utils", () => ({
  validateUserSession: mocks.validateUserSession,
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));

vi.mock("@/core/libsql/users/getSubcomerciales", () => ({
  getSubcomerciales: vi.fn(),
}));

vi.mock("@/tramites/utils/updateTramiteHelpers", () => ({
  updateClient: vi.fn(),
}));

vi.mock("@/core/firebase/firebaseConfig", () => ({
  storage: { name: "test-storage" },
}));

vi.mock("firebase/storage", () => ({
  deleteObject: mocks.deleteObject,
  listAll: mocks.listAll,
  ref: mocks.ref,
}));

const params = { params: Promise.resolve({ id: "CLI-1" }) };

const createRequest = () =>
  ({
    json: async () => ({ organization_id: "ORG-1" }),
    headers: new Headers(),
  }) as NextRequest;

const sqlCalls = () =>
  mocks.execute.mock.calls.map(([statement]) => String(statement.sql));

describe("DELETE /api/v2/clients/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
    mocks.ref.mockImplementation((_storage, path: string) => ({
      fullPath: path,
    }));
    mocks.listAll.mockResolvedValue({ items: [], prefixes: [] });
    mocks.deleteObject.mockResolvedValue(undefined);
  });

  test.each(["1", "2"])("rejects non-admin role %s", async (role) => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "USER-1",
        role,
        email: "user@crm.test",
        name: "User",
      },
    });

    const response = await DELETE(createRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ success: false, error: "Forbidden" });
    expect(mocks.getTursoClient).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("allows admin and deletes Firebase folders before database client", async () => {
    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "ADMIN-1",
        role: "admin",
        email: "admin@crm.test",
        name: "Admin",
      },
    });
    mocks.execute.mockImplementation(async (statement) => {
      const sql = String(statement.sql);
      if (sql.includes("SELECT id FROM clients")) {
        return { rows: [{ id: "CLI-1" }], rowsAffected: 0 };
      }
      if (sql.includes("SELECT id FROM tramites")) {
        return {
          rows: [{ id: "TR-1" }, { id: "TR-2" }],
          rowsAffected: 0,
        };
      }
      if (sql.includes("DELETE FROM clients")) {
        return { rows: [], rowsAffected: 1 };
      }
      return { rows: [], rowsAffected: 0 };
    });
    mocks.listAll.mockImplementation(async (folderRef) => {
      if (folderRef.fullPath.endsWith("TR-1")) {
        return {
          items: [{ fullPath: "ORG-1/tramites/TR-1/a.pdf" }],
          prefixes: [],
        };
      }
      if (folderRef.fullPath.endsWith("TR-2")) {
        return {
          items: [
            { fullPath: "ORG-1/tramites/TR-2/b.pdf" },
            { fullPath: "ORG-1/tramites/TR-2/c.pdf" },
          ],
          prefixes: [],
        };
      }
      return { items: [], prefixes: [] };
    });

    const response = await DELETE(createRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        client_id: "CLI-1",
        contracts_deleted: 2,
        firebase_files_deleted: 3,
      },
    });
    expect(mocks.ref).toHaveBeenCalledWith(
      { name: "test-storage" },
      "ORG-1/tramites/TR-1",
    );
    expect(mocks.ref).toHaveBeenCalledWith(
      { name: "test-storage" },
      "ORG-1/tramites/TR-2",
    );
    expect(mocks.deleteObject).toHaveBeenCalledTimes(3);
    expect(sqlCalls().at(-1)).toContain("DELETE FROM clients");
  });

  test("does not delete database client when Firebase deletion fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mocks.validateUserSession.mockResolvedValue({
      success: true,
      user: {
        id: "ADMIN-1",
        role: "admin",
        email: "admin@crm.test",
        name: "Admin",
      },
    });
    mocks.execute.mockImplementation(async (statement) => {
      const sql = String(statement.sql);
      if (sql.includes("SELECT id FROM clients")) {
        return { rows: [{ id: "CLI-1" }], rowsAffected: 0 };
      }
      if (sql.includes("SELECT id FROM tramites")) {
        return { rows: [{ id: "TR-1" }], rowsAffected: 0 };
      }
      if (sql.includes("DELETE FROM clients")) {
        return { rows: [], rowsAffected: 1 };
      }
      return { rows: [], rowsAffected: 0 };
    });
    mocks.listAll.mockRejectedValue(new Error("storage unavailable"));

    const response = await DELETE(createRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: "Error al eliminar los archivos asociados al cliente",
    });
    expect(sqlCalls()).not.toContain("DELETE FROM clients WHERE id = ?");

    consoleErrorSpy.mockRestore();
  });
});
