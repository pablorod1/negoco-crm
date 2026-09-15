import { beforeEach, describe, expect, test, vi } from "vitest";

import { moveDocumentLibrary } from "./move-client";
import type { MovePlan } from "./move-types";

const mocks = vi.hoisted(() => ({
  getBlob: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
  listAll: vi.fn(),
  planDocumentLibraryMove: vi.fn(),
  commitDocumentLibraryMove: vi.fn(),
}));

vi.mock("@/core/firebase/firebaseConfig", () => ({
  storage: { name: "test-storage" },
}));

vi.mock("firebase/storage", () => ({
  ref: (_storage: unknown, path: string) => ({
    fullPath: path,
    name: path.split("/").pop(),
  }),
  getBlob: mocks.getBlob,
  uploadBytes: mocks.uploadBytes,
  getDownloadURL: mocks.getDownloadURL,
  deleteObject: mocks.deleteObject,
  listAll: mocks.listAll,
  getMetadata: vi.fn(),
}));

vi.mock("./document-library-api", () => ({
  planDocumentLibraryMove: mocks.planDocumentLibraryMove,
  commitDocumentLibraryMove: mocks.commitDocumentLibraryMove,
}));

const url = (path: string) => `https://storage.test/o/${encodeURIComponent(path)}`;

const plan: MovePlan = {
  target_folder: "Endesa",
  storage_prefixes: [],
  items: [
    {
      id: "f1",
      name: "tarifa.pdf",
      source_folder: "Manuales",
      target_folder: "Endesa",
      source_path: "ORG/documentacion/Manuales/tarifa.pdf",
      destination_path: "ORG/documentacion/Endesa/tarifa.pdf",
      in_place: false,
      has_preview: false,
    },
  ],
};

const request = {
  kind: "files" as const,
  file_ids: ["f1"],
  destination_folder: "Endesa",
};

describe("moveDocumentLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.planDocumentLibraryMove.mockResolvedValue({ success: true, plan });
    mocks.commitDocumentLibraryMove.mockResolvedValue({ success: true });
    mocks.getBlob.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    mocks.uploadBytes.mockResolvedValue(undefined);
    mocks.getDownloadURL.mockImplementation(async (ref: { fullPath: string }) =>
      url(ref.fullPath)
    );
    mocks.deleteObject.mockResolvedValue(undefined);
    mocks.listAll.mockResolvedValue({ items: [], prefixes: [] });
  });

  test("copies in the browser, commits and then deletes the source", async () => {
    const progress: Array<{ done: number; total: number }> = [];

    const result = await moveDocumentLibrary("ORG", request, (p) =>
      progress.push({ done: p.done, total: p.total })
    );

    expect(result).toEqual({ success: true });
    expect(mocks.uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: "ORG/documentacion/Endesa/tarifa.pdf" }),
      expect.any(Blob),
      { contentType: "application/pdf" }
    );
    expect(mocks.commitDocumentLibraryMove).toHaveBeenCalledWith({
      organizationId: "ORG",
      request,
      updates: [{ id: "f1", download_url: url("ORG/documentacion/Endesa/tarifa.pdf") }],
    });
    // El origen se borra sólo tras el commit
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: "ORG/documentacion/Manuales/tarifa.pdf" })
    );
    expect(progress).toEqual([
      { done: 0, total: 1 },
      { done: 0, total: 1 },
      { done: 1, total: 1 },
    ]);
  });

  test("stops without touching storage when the plan is refused", async () => {
    mocks.planDocumentLibraryMove.mockResolvedValue({
      success: false,
      error: "Ya existen archivos con el mismo nombre en la carpeta destino.",
      conflicts: ["tarifa.pdf"],
    });

    const result = await moveDocumentLibrary("ORG", request);

    expect(result).toMatchObject({ success: false, conflicts: ["tarifa.pdf"] });
    expect(mocks.getBlob).not.toHaveBeenCalled();
  });

  test("removes the copies and keeps the source when the commit fails", async () => {
    mocks.commitDocumentLibraryMove.mockResolvedValue({
      success: false,
      error: "db down",
    });

    const result = await moveDocumentLibrary("ORG", request);

    expect(result).toMatchObject({ success: false, error: "db down" });
    expect(mocks.deleteObject).toHaveBeenCalledTimes(1);
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: "ORG/documentacion/Endesa/tarifa.pdf" })
    );
  });

  test("also moves storage objects without a database row under the folder prefixes", async () => {
    mocks.planDocumentLibraryMove.mockResolvedValue({
      success: true,
      plan: {
        ...plan,
        storage_prefixes: [
          {
            source_prefix: "ORG/documentacion/Manuales",
            destination_prefix: "ORG/documentacion/Endesa/Manuales",
          },
        ],
      },
    });
    mocks.listAll.mockResolvedValue({
      prefixes: [],
      items: [
        { fullPath: "ORG/documentacion/Manuales/tarifa.pdf", name: "tarifa.pdf" },
        { fullPath: "ORG/documentacion/Manuales/huerfano.pdf", name: "huerfano.pdf" },
      ],
    });

    const result = await moveDocumentLibrary("ORG", request);

    expect(result).toEqual({ success: true });
    expect(mocks.uploadBytes).toHaveBeenCalledTimes(2);
    expect(mocks.uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        fullPath: "ORG/documentacion/Endesa/Manuales/huerfano.pdf",
      }),
      expect.any(Blob),
      expect.anything()
    );
    // El huérfano no tiene fila: no va en el commit
    expect(mocks.commitDocumentLibraryMove.mock.calls[0][0].updates).toHaveLength(1);
  });
});
