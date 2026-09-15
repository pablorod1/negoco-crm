import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getTursoClient: vi.fn(),
  deleteFolderFromStorage: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClient: mocks.getTursoClient,
}));

vi.mock("@/core/firebase/data/deleteFolder", () => ({
  deleteFolderFromStorage: mocks.deleteFolderFromStorage,
}));

const createRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
    headers: new Headers(),
  }) as NextRequest;

describe("DELETE /api/v2/document-library/folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTursoClient.mockReturnValue({ execute: mocks.execute });
    // Comercializadoras activas del tenant
    mocks.execute.mockImplementation(async (statement: { sql: string }) =>
      statement.sql.includes("FROM comercializadoras")
        ? { rows: [{ name: "Endesa" }, { name: "Total Energies" }] }
        : { rows: [], rowsAffected: 0 }
    );
    mocks.deleteFolderFromStorage.mockResolvedValue({ success: true });
  });

  test("refuses to delete the folder of an active supplier", async () => {
    const response = await DELETE(
      createRequest({ folder_path: "TOTALENERGIES", organization_id: "ORG" })
    );

    expect(response.status).toBe(403);
    expect(mocks.deleteFolderFromStorage).not.toHaveBeenCalled();
  });

  test("deletes a regular folder subtree from storage and database", async () => {
    const response = await DELETE(
      createRequest({ folder_path: " Manuales / 2026 ", organization_id: "ORG" })
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteFolderFromStorage).toHaveBeenCalledWith(
      "documentacion",
      "Manuales/2026",
      "ORG"
    );

    const deleteCall = mocks.execute.mock.calls.find(([statement]) =>
      String(statement.sql).includes("DELETE FROM documentacion_files")
    );
    expect(deleteCall?.[0].args).toEqual(["Manuales/2026", "Manuales/2026/%"]);
  });

  test("allows deleting a subfolder inside a supplier folder", async () => {
    const response = await DELETE(
      createRequest({ folder_path: "Endesa/Contratos", organization_id: "ORG" })
    );

    expect(response.status).toBe(200);
  });
});
