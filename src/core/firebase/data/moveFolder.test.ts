import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Client } from "@libsql/client";

const mocks = vi.hoisted(() => ({
  deleteObject: vi.fn(),
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

vi.mock("@/core/firebase/firebaseConfig", () => ({
  storage: { name: "test-storage" },
}));

vi.mock("firebase/storage", () => ({
  deleteObject: mocks.deleteObject,
  getDownloadURL: mocks.getDownloadURL,
  ref: mocks.ref,
  uploadBytes: mocks.uploadBytes,
}));

const { moveFolderFromComparativasToTramites } = await import("./moveFolder");

const organizationId = "organization-1";
const comparativaId = "comparison-1";
const tramiteId = "contract-1";
const sourceUrl = "https://firebasestorage.example/abarca-document.pdf";
const destinationUrl =
  "https://firebasestorage.example/contract-document.pdf";

const fileRow = {
  id: "file-1",
  comparativa_id: comparativaId,
  filename: "estudio_acme.pdf",
  size: 2048,
  extension: "pdf",
  upload_date: "2026-08-27T08:00:00.000Z",
  download_url: sourceUrl,
  preview_url: null,
};

function createDatabase(rows = [fileRow]) {
  const transaction = {
    execute: vi.fn(async (statement: { sql: string }) => {
      if (statement.sql.includes("DELETE FROM comparativa_files")) {
        return { rows: [], rowsAffected: rows.length };
      }
      return { rows: [], rowsAffected: 1 };
    }),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
  };
  const client = {
    execute: vi.fn(async () => ({ rows, rowsAffected: 0 })),
    transaction: vi.fn(async () => transaction),
  };

  return { client: client as unknown as Client, transaction };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Blob(["document"]), { status: 200 })),
  );
  mocks.ref.mockImplementation((_storage, path: string) => ({
    fullPath:
      path === sourceUrl
        ? `${organizationId}/comparativas/${comparativaId}/abarca/claim-1/estudio_acme.pdf`
        : path,
  }));
  mocks.getDownloadURL.mockResolvedValue(destinationUrl);
  mocks.uploadBytes.mockResolvedValue({});
  mocks.deleteObject.mockResolvedValue(undefined);
});

describe("moveFolderFromComparativasToTramites", () => {
  test("moves a nested Abarca document using its persisted URL", async () => {
    const { client, transaction } = createDatabase();

    await expect(
      moveFolderFromComparativasToTramites(
        client,
        organizationId,
        comparativaId,
        tramiteId,
      ),
    ).resolves.toEqual({ success: true });

    const destinationPath = `${organizationId}/tramites/${tramiteId}/${fileRow.id}/${fileRow.filename}`;
    expect(mocks.ref).toHaveBeenCalledWith(expect.anything(), sourceUrl);
    expect(mocks.ref).toHaveBeenCalledWith(expect.anything(), destinationPath);
    expect(mocks.uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: destinationPath }),
      expect.any(Blob),
    );
    expect(transaction.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("INSERT INTO tramite_files"),
        args: [
          fileRow.id,
          fileRow.filename,
          fileRow.size,
          fileRow.extension,
          fileRow.upload_date,
          tramiteId,
          destinationUrl,
          null,
        ],
      }),
    );
    expect(transaction.commit).toHaveBeenCalledOnce();
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({
        fullPath: `${organizationId}/comparativas/${comparativaId}/abarca/claim-1/estudio_acme.pdf`,
      }),
    );
    expect(transaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteObject.mock.invocationCallOrder[0],
    );
  });

  test("fails before copying or mutating the database when the URL is empty", async () => {
    const { client, transaction } = createDatabase([
      { ...fileRow, download_url: "" },
    ]);

    const result = await moveFolderFromComparativasToTramites(
      client,
      organizationId,
      comparativaId,
      tramiteId,
    );

    expect(result).toEqual({
      success: false,
      error: `El archivo ${fileRow.id} no tiene una URL de descarga válida`,
    });
    expect(mocks.uploadBytes).not.toHaveBeenCalled();
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  test("rejects a source object outside the expected comparison folder", async () => {
    mocks.ref.mockImplementation((_storage, path: string) => ({
      fullPath:
        path === sourceUrl
          ? "another-organization/comparativas/comparison-2/document.pdf"
          : path,
    }));
    const { client, transaction } = createDatabase();

    const result = await moveFolderFromComparativasToTramites(
      client,
      organizationId,
      comparativaId,
      tramiteId,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("no pertenece a la comparativa esperada");
    expect(mocks.uploadBytes).not.toHaveBeenCalled();
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  test("rolls back without deleting the source when the database write fails", async () => {
    const { client, transaction } = createDatabase();
    transaction.execute.mockRejectedValueOnce(new Error("database unavailable"));

    const result = await moveFolderFromComparativasToTramites(
      client,
      organizationId,
      comparativaId,
      tramiteId,
    );

    expect(result).toEqual({
      success: false,
      error: "database unavailable",
    });
    expect(transaction.rollback).toHaveBeenCalledOnce();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });
});
