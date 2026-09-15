import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Client } from "@libsql/client";

import {
  commitDocumentLibraryMove,
  planDocumentLibraryMove,
} from "./document-library-move";

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(),
  listAll: vi.fn(),
}));

vi.mock("@/core/firebase/firebaseConfig", () => ({
  storage: { name: "test-storage" },
}));

vi.mock("firebase/storage", () => ({
  ref: (_storage: unknown, path: string) => {
    // Las URLs de descarga se traducen a su ruta, como hace el SDK
    const fullPath = path.startsWith("https://")
      ? decodeURIComponent(path.split("/o/")[1].split("?")[0])
      : path;
    return { fullPath, name: fullPath.split("/").pop() };
  },
  getMetadata: mocks.getMetadata,
  listAll: mocks.listAll,
}));

const url = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/bucket/o/${encodeURIComponent(path)}?alt=media&token=t`;

const notFound = Object.assign(new Error("not found"), {
  code: "storage/object-not-found",
});

interface Row {
  id: string;
  name: string;
  folder_name: string;
  download_url: string;
  preview_url: string | null;
}

function createClient(rows: Row[]) {
  const transaction = {
    execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };
  const execute = vi.fn(async (statement: { sql: string; args: unknown[] }) => {
    const sql = statement.sql;
    if (sql.includes("WHERE id IN")) {
      return { rows: rows.filter((row) => statement.args.includes(row.id)) };
    }
    if (sql.includes("SELECT name FROM documentacion_files")) {
      return {
        rows: rows
          .filter((row) => row.folder_name === statement.args[0])
          .map((row) => ({ name: row.name })),
      };
    }
    // Subárbol (mover carpeta y "existe la carpeta")
    const [exact, like] = statement.args as [string, string];
    const prefix = like.slice(0, -1);
    const matches = rows.filter(
      (row) => row.folder_name === exact || row.folder_name.startsWith(prefix)
    );
    return { rows: sql.includes("SELECT 1") ? matches.slice(0, 1) : matches };
  });
  return {
    client: { execute, transaction: vi.fn().mockResolvedValue(transaction) } as unknown as Client,
    transaction,
  };
}

const options = {
  organizationId: "ORG",
  activeSupplierNames: ["Endesa"],
  checkStorage: true,
};

const tarifa: Row = {
  id: "f1",
  name: "tarifa.pdf",
  folder_name: "Manuales",
  download_url: url("ORG/documentacion/Manuales/tarifa.pdf"),
  preview_url: null,
};

describe("planDocumentLibraryMove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMetadata.mockRejectedValue(notFound);
    mocks.listAll.mockResolvedValue({ items: [], prefixes: [] });
  });

  test("plans a file move with its storage paths", async () => {
    const { client } = createClient([tarifa]);

    const outcome = await planDocumentLibraryMove(
      client,
      { kind: "files", file_ids: ["f1"], destination_folder: " Endesa /" },
      options
    );

    expect(outcome).toEqual({
      success: true,
      plan: {
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
      },
    });
  });

  test("reports conflicts with existing names in the destination", async () => {
    const { client } = createClient([
      tarifa,
      { ...tarifa, id: "f2", folder_name: "Endesa" },
    ]);

    const outcome = await planDocumentLibraryMove(
      client,
      { kind: "files", file_ids: ["f1"], destination_folder: "Endesa" },
      options
    );

    expect(outcome).toMatchObject({ success: false, status: 409, conflicts: ["tarifa.pdf"] });
  });

  test("treats an object already present in storage as a conflict only when checking storage", async () => {
    const { client } = createClient([tarifa]);
    mocks.getMetadata.mockResolvedValue({});

    const withStorage = await planDocumentLibraryMove(
      client,
      { kind: "files", file_ids: ["f1"], destination_folder: "Endesa" },
      options
    );
    const withoutStorage = await planDocumentLibraryMove(
      client,
      { kind: "files", file_ids: ["f1"], destination_folder: "Endesa" },
      { ...options, checkStorage: false }
    );

    expect(withStorage.success).toBe(false);
    expect(withoutStorage.success).toBe(true);
  });

  test("refuses protected supplier folders and reserved targets", async () => {
    const { client } = createClient([]);

    expect(
      await planDocumentLibraryMove(
        client,
        { kind: "folder", folder_path: "ENDESA", new_name: "Otra" },
        options
      )
    ).toMatchObject({ success: false, status: 403 });

    expect(
      await planDocumentLibraryMove(
        client,
        { kind: "folder", folder_path: "Manuales", new_name: "endesa" },
        options
      )
    ).toMatchObject({ success: false, status: 409, conflicts: ["endesa"] });

    expect(
      await planDocumentLibraryMove(
        client,
        { kind: "folder", folder_path: "Manuales", destination_parent: "Manuales/2026" },
        options
      )
    ).toMatchObject({ success: false, status: 400 });
  });

  test("plans a folder move rebasing every row of the subtree", async () => {
    const { client } = createClient([
      tarifa,
      {
        ...tarifa,
        id: "f2",
        name: "enero.pdf",
        folder_name: "Manuales/2026",
        download_url: url("ORG/documentacion/Manuales/2026/enero.pdf"),
        preview_url: url("ORG/documentacion/Manuales/2026/enero.pdf"),
      },
    ]);
    // En la raíz sólo existe "Manuales"; el destino "Endesa/Manuales" está libre
    mocks.listAll.mockImplementation(async (ref: { fullPath: string }) =>
      ref.fullPath === "ORG/documentacion"
        ? {
            items: [],
            prefixes: [{ name: "Manuales", fullPath: "ORG/documentacion/Manuales" }],
          }
        : { items: [], prefixes: [] }
    );

    const outcome = await planDocumentLibraryMove(
      client,
      { kind: "folder", folder_path: "Manuales", destination_parent: "Endesa" },
      options
    );

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    expect(outcome.plan.target_folder).toBe("Endesa/Manuales");
    expect(outcome.plan.items.map((item) => [item.target_folder, item.destination_path])).toEqual([
      ["Endesa/Manuales", "ORG/documentacion/Endesa/Manuales/tarifa.pdf"],
      ["Endesa/Manuales/2026", "ORG/documentacion/Endesa/Manuales/2026/enero.pdf"],
    ]);
    expect(outcome.plan.items[1].has_preview).toBe(true);
    expect(outcome.plan.storage_prefixes).toEqual([
      {
        source_prefix: "ORG/documentacion/Manuales",
        destination_prefix: "ORG/documentacion/Endesa/Manuales",
      },
    ]);
  });
});

describe("commitDocumentLibraryMove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMetadata.mockResolvedValue({});
    mocks.listAll.mockResolvedValue({ items: [], prefixes: [] });
  });

  test("rewrites the rows in a transaction when the copies match the plan", async () => {
    const { client, transaction } = createClient([tarifa]);

    const outcome = await commitDocumentLibraryMove(
      client,
      { kind: "files", file_ids: ["f1"], destination_folder: "Endesa" },
      [{ id: "f1", download_url: url("ORG/documentacion/Endesa/tarifa.pdf") }],
      options
    );

    expect(outcome).toEqual({ success: true, moved: 1 });
    expect(transaction.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ["Endesa", url("ORG/documentacion/Endesa/tarifa.pdf"), null, "f1"],
      })
    );
    expect(transaction.commit).toHaveBeenCalled();
  });

  test("rejects copies that do not point to the planned destination", async () => {
    const { client, transaction } = createClient([tarifa]);

    const outcome = await commitDocumentLibraryMove(
      client,
      { kind: "files", file_ids: ["f1"], destination_folder: "Endesa" },
      [{ id: "f1", download_url: url("ORG/documentacion/Otra/tarifa.pdf") }],
      options
    );

    expect(outcome).toMatchObject({ success: false, status: 400 });
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  test("rolls back when the database fails", async () => {
    const { client, transaction } = createClient([tarifa]);
    transaction.execute.mockRejectedValue(new Error("db down"));

    const outcome = await commitDocumentLibraryMove(
      client,
      { kind: "files", file_ids: ["f1"], destination_folder: "Endesa" },
      [{ id: "f1", download_url: url("ORG/documentacion/Endesa/tarifa.pdf") }],
      options
    );

    expect(outcome).toMatchObject({ success: false, status: 500, error: "db down" });
    expect(transaction.rollback).toHaveBeenCalled();
  });
});
