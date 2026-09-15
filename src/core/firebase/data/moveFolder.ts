import type { Client, Transaction } from "@libsql/client";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type StorageReference,
} from "firebase/storage";
import { storage } from "../firebaseConfig";
import type { ComparativaFile } from "@/comparativas/types";

interface CopiedComparativaFile {
  file: ComparativaFile;
  sourceRef: StorageReference;
  downloadURL: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseComparativaFile(
  row: Record<string, unknown>,
  comparativaId: string,
): ComparativaFile {
  const id = String(row.id ?? "");
  const downloadUrl = String(row.download_url ?? "").trim();

  if (!id) {
    throw new Error("La comparativa contiene un archivo sin identificador");
  }
  if (!downloadUrl) {
    throw new Error(`El archivo ${id} no tiene una URL de descarga válida`);
  }

  return {
    id,
    comparativa_id: comparativaId,
    filename: String(row.filename ?? ""),
    size: Number(row.size),
    extension: String(row.extension ?? ""),
    upload_date: String(row.upload_date ?? ""),
    download_url: downloadUrl,
    preview_url:
      row.preview_url === null || row.preview_url === undefined
        ? null
        : String(row.preview_url),
  };
}

async function copyFileToTramite(
  file: ComparativaFile,
  organizationId: string,
  comparativaId: string,
  tramiteId: string,
): Promise<CopiedComparativaFile> {
  const sourceRef = ref(storage, file.download_url);
  const expectedSourcePrefix = `${organizationId}/comparativas/${comparativaId}/`;

  if (!sourceRef.fullPath.startsWith(expectedSourcePrefix)) {
    throw new Error(
      `El archivo ${file.id} no pertenece a la comparativa esperada`,
    );
  }

  const response = await fetch(file.download_url);
  if (!response.ok) {
    throw new Error(
      `No se pudo descargar el archivo ${file.id}: HTTP ${response.status}`,
    );
  }

  const destinationRef = ref(
    storage,
    `${organizationId}/tramites/${tramiteId}/${file.id}/${file.filename}`,
  );
  await uploadBytes(destinationRef, await response.blob());
  const downloadURL = await getDownloadURL(destinationRef);

  if (!downloadURL) {
    throw new Error(
      `Firebase no devolvió una URL de descarga para el archivo ${file.id}`,
    );
  }

  return { file, sourceRef, downloadURL };
}

async function rollbackTransaction(transaction: Transaction): Promise<void> {
  try {
    await transaction.rollback();
  } catch (rollbackError) {
    console.error("Error rolling back file conversion:", rollbackError);
  }
}

/**
 * Copies comparison files before atomically transferring their database rows.
 * Source objects are removed only after the database commit, so failures remain
 * recoverable and can be retried without losing the original documents.
 */
export const moveFolderFromComparativasToTramites = async (
  tursoClient: Client,
  organizationId: string,
  comparativaId: string,
  tramiteId: string,
): Promise<{ success: boolean; error?: string }> => {
  let transaction: Transaction | undefined;

  try {
    const comparativaRows = await tursoClient.execute({
      sql: `SELECT * FROM comparativa_files WHERE comparativa_id = ?`,
      args: [comparativaId],
    });

    if (comparativaRows.rows.length === 0) {
      return {
        success: false,
        error: `No hay archivos en la tabla comparativa_files para la comparativa ${comparativaId}`,
      };
    }

    const files = comparativaRows.rows.map((row) =>
      parseComparativaFile(row, comparativaId),
    );
    const copiedFiles = await Promise.all(
      files.map((file) =>
        copyFileToTramite(
          file,
          organizationId,
          comparativaId,
          tramiteId,
        ),
      ),
    );

    transaction = await tursoClient.transaction("write");

    for (const { file, downloadURL } of copiedFiles) {
      await transaction.execute({
        sql: `
          INSERT INTO tramite_files (id, filename, size, extension, upload_date, tramite_id, download_url, preview_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          file.id,
          file.filename,
          file.size,
          file.extension,
          file.upload_date,
          tramiteId,
          downloadURL,
          file.preview_url ? downloadURL : null,
        ],
      });
    }

    const deletionResponse = await transaction.execute({
      sql: "DELETE FROM comparativa_files WHERE comparativa_id = ?",
      args: [comparativaId],
    });

    if (deletionResponse.rowsAffected !== files.length) {
      throw new Error(
        "No se pudieron transferir todos los archivos de la comparativa",
      );
    }

    await transaction.commit();
    transaction = undefined;

    const cleanupResults = await Promise.allSettled(
      copiedFiles.map(({ sourceRef }) => deleteObject(sourceRef)),
    );
    for (const result of cleanupResults) {
      if (result.status === "rejected") {
        console.error(
          "Error deleting a comparison file after conversion:",
          result.reason,
        );
      }
    }

    return { success: true };
  } catch (error) {
    if (transaction) {
      await rollbackTransaction(transaction);
    }
    console.error("Error moving comparison files:", error);
    return { success: false, error: getErrorMessage(error) };
  }
};
