import type { Client, Transaction } from "@libsql/client";
import { listAll, ref } from "firebase/storage";

import { storage } from "@/core/firebase/firebaseConfig";
import {
  documentacionFileRef,
  documentacionStoragePath,
  storageObjectExists,
} from "@/core/firebase/data/documentacionStorage";
import { resolveDocumentacionStorageFolderPaths } from "@/core/firebase/data/getFolders";
import {
  getFirebaseStoragePathFromDownloadUrl,
  normalizeDocumentLibraryFolderPath,
} from "@/core/utils/document-library-path";
import {
  getDocumentLibraryFolderSubtreeArgs,
  getDocumentLibraryFolderSubtreeSql,
  getNormalizedDocumentLibraryFolderNameSql,
} from "@/documentacion/lib/documentLibraryFolderSql";
import {
  isProtectedSupplierFolder,
  PROTECTED_FOLDER_MESSAGE,
} from "@/documentacion/lib/protected-folders";
import type {
  MoveCommitUpdate,
  MovePlan,
  MovePlanItem,
  MoveRequest,
} from "@/documentacion/lib/move-types";

export type PlanOutcome =
  | { success: true; plan: MovePlan }
  | { success: false; status: 400 | 403 | 404 | 409; error: string; conflicts?: string[] };

export interface CommitOutcome {
  success: boolean;
  status?: 400 | 403 | 404 | 409 | 500;
  error?: string;
  conflicts?: string[];
  moved?: number;
}

interface PlanOptions {
  organizationId: string;
  activeSupplierNames: string[];
  /**
   * En el plan se comprueba que el destino esté libre también en Storage. En
   * el commit no: el navegador ya ha copiado allí.
   */
  checkStorage: boolean;
}

interface StoredFileRow {
  id: string;
  name: string;
  folder_name: string;
  download_url: string;
  preview_url: string | null;
}

function rowToFile(row: Record<string, unknown>): StoredFileRow {
  return {
    id: String(row.id),
    name: String(row.name ?? "").trim(),
    folder_name: normalizeDocumentLibraryFolderPath(String(row.folder_name ?? "")),
    download_url: String(row.download_url ?? ""),
    preview_url:
      row.preview_url === null || row.preview_url === undefined
        ? null
        : String(row.preview_url),
  };
}

async function loadFilesByIds(
  tursoClient: Client,
  fileIds: string[]
): Promise<StoredFileRow[]> {
  if (fileIds.length === 0) return [];
  const response = await tursoClient.execute({
    sql: `
      SELECT id, name, folder_name, download_url, preview_url
      FROM documentacion_files
      WHERE id IN (${fileIds.map(() => "?").join(", ")})
    `,
    args: fileIds,
  });
  return response.rows.map((row) => rowToFile(row as Record<string, unknown>));
}

async function loadFilesInSubtree(
  tursoClient: Client,
  folderPath: string
): Promise<StoredFileRow[]> {
  const response = await tursoClient.execute({
    sql: `
      SELECT id, name, folder_name, download_url, preview_url
      FROM documentacion_files
      WHERE ${getDocumentLibraryFolderSubtreeSql()}
    `,
    args: getDocumentLibraryFolderSubtreeArgs(folderPath),
  });
  return response.rows.map((row) => rowToFile(row as Record<string, unknown>));
}

async function loadNamesInFolder(
  tursoClient: Client,
  folderPath: string
): Promise<Set<string>> {
  const response = await tursoClient.execute({
    sql: `
      SELECT name FROM documentacion_files
      WHERE ${getNormalizedDocumentLibraryFolderNameSql()} = ?
    `,
    args: [folderPath],
  });
  return new Set(response.rows.map((row) => String(row.name ?? "").trim()));
}

/** ¿Hay algo (en la BD o, si se pide, en Storage) bajo esta carpeta? */
async function folderExists(
  tursoClient: Client,
  organizationId: string,
  folderPath: string,
  checkStorage: boolean
): Promise<boolean> {
  const response = await tursoClient.execute({
    sql: `
      SELECT 1 FROM documentacion_files
      WHERE ${getDocumentLibraryFolderSubtreeSql()}
      LIMIT 1
    `,
    args: getDocumentLibraryFolderSubtreeArgs(folderPath),
  });
  if (response.rows.length > 0) return true;
  if (!checkStorage) return false;

  const storagePaths = await resolveDocumentacionStorageFolderPaths(
    folderPath,
    organizationId
  );
  for (const storagePath of storagePaths) {
    const listing = await listAll(ref(storage, storagePath));
    if (listing.items.length > 0 || listing.prefixes.length > 0) return true;
  }
  return false;
}

function toPlanItem(
  organizationId: string,
  file: StoredFileRow,
  targetFolder: string
): MovePlanItem {
  const sourcePath = documentacionFileRef(organizationId, file).fullPath;
  const destinationPath = documentacionStoragePath(
    organizationId,
    targetFolder,
    file.name
  );
  return {
    id: file.id,
    name: file.name,
    source_folder: file.folder_name,
    target_folder: targetFolder,
    source_path: sourcePath,
    destination_path: destinationPath,
    // Fila legacy desalineada: el objeto ya está donde debe, sólo se corrige la BD
    in_place: sourcePath === destinationPath,
    has_preview: Boolean(file.preview_url),
  };
}

async function planFiles(
  tursoClient: Client,
  request: Extract<MoveRequest, { kind: "files" }>,
  { organizationId, checkStorage }: PlanOptions
): Promise<PlanOutcome> {
  const fileIds = Array.from(new Set(request.file_ids));
  const target = normalizeDocumentLibraryFolderPath(request.destination_folder);
  const rows = await loadFilesByIds(tursoClient, fileIds);

  if (rows.length !== fileIds.length) {
    return {
      success: false,
      status: 404,
      error: "Alguno de los archivos ya no existe. Recarga la página.",
    };
  }

  const items = rows
    .filter((file) => file.folder_name !== target)
    .map((file) => toPlanItem(organizationId, file, target));

  // Conflictos: con lo que ya hay en el destino (BD y Storage) y entre sí
  const existingNames = await loadNamesInFolder(tursoClient, target);
  const conflicts = new Set<string>();
  const seen = new Set<string>();
  for (const item of items) {
    if (
      existingNames.has(item.name) ||
      seen.has(item.name) ||
      (checkStorage &&
        !item.in_place &&
        (await storageObjectExists(item.destination_path)))
    ) {
      conflicts.add(item.name);
    }
    seen.add(item.name);
  }
  if (conflicts.size > 0) {
    return {
      success: false,
      status: 409,
      conflicts: Array.from(conflicts),
      error: "Ya existen archivos con el mismo nombre en la carpeta destino.",
    };
  }

  return { success: true, plan: { target_folder: target, items, storage_prefixes: [] } };
}

async function planFolder(
  tursoClient: Client,
  request: Extract<MoveRequest, { kind: "folder" }>,
  { organizationId, activeSupplierNames, checkStorage }: PlanOptions
): Promise<PlanOutcome> {
  const source = normalizeDocumentLibraryFolderPath(request.folder_path);
  if (source === "/") {
    return { success: false, status: 400, error: "No se puede mover la carpeta raíz." };
  }
  if (isProtectedSupplierFolder(source, activeSupplierNames)) {
    return { success: false, status: 403, error: PROTECTED_FOLDER_MESSAGE };
  }

  const sourceSegments = source.split("/");
  const name = (request.new_name ?? sourceSegments[sourceSegments.length - 1]).trim();
  if (!name) {
    return { success: false, status: 400, error: "El nombre de la carpeta no puede estar vacío." };
  }
  if (name.includes("/")) {
    return { success: false, status: 400, error: "El nombre de la carpeta no puede contener «/»." };
  }

  const parent =
    request.destination_parent === undefined
      ? sourceSegments.slice(0, -1).join("/")
      : request.destination_parent;
  const target = normalizeDocumentLibraryFolderPath(`${parent}/${name}`);

  if (target === source) {
    return { success: true, plan: { target_folder: target, items: [], storage_prefixes: [] } };
  }
  if (target.startsWith(`${source}/`)) {
    return {
      success: false,
      status: 400,
      error: "No se puede mover una carpeta dentro de sí misma.",
    };
  }
  // La carpeta (aún virtual) de una comercializadora activa está reservada
  if (
    isProtectedSupplierFolder(target, activeSupplierNames) ||
    (await folderExists(tursoClient, organizationId, target, checkStorage))
  ) {
    return {
      success: false,
      status: 409,
      conflicts: [target],
      error: "Ya existe una carpeta con ese nombre en el destino.",
    };
  }

  const rows = await loadFilesInSubtree(tursoClient, source);
  const items = rows.map((file) =>
    toPlanItem(organizationId, file, target + file.folder_name.slice(source.length))
  );
  const sourcePrefixes = await resolveDocumentacionStorageFolderPaths(
    source,
    organizationId
  );

  return {
    success: true,
    plan: {
      target_folder: target,
      items,
      storage_prefixes: sourcePrefixes.map((source_prefix) => ({
        source_prefix,
        destination_prefix: documentacionStoragePath(organizationId, target),
      })),
    },
  };
}

export async function planDocumentLibraryMove(
  tursoClient: Client,
  request: MoveRequest,
  options: PlanOptions
): Promise<PlanOutcome> {
  return request.kind === "files"
    ? planFiles(tursoClient, request, options)
    : planFolder(tursoClient, request, options);
}

async function rollbackQuietly(transaction: Transaction): Promise<void> {
  try {
    await transaction.rollback();
  } catch (error) {
    console.error("Error rolling back document library move:", error);
  }
}

/**
 * Reescribe las filas una vez el navegador ha copiado los objetos. Se vuelve a
 * planificar (sin mirar Storage) para no fiarse del plan que envía el cliente,
 * y cada URL nueva debe apuntar exactamente a la ruta prevista.
 */
export async function commitDocumentLibraryMove(
  tursoClient: Client,
  request: MoveRequest,
  updates: MoveCommitUpdate[],
  options: Omit<PlanOptions, "checkStorage">
): Promise<CommitOutcome> {
  const outcome = await planDocumentLibraryMove(tursoClient, request, {
    ...options,
    checkStorage: false,
  });
  if (!outcome.success) return outcome;

  const { items } = outcome.plan;
  const updateById = new Map(updates.map((update) => [update.id, update]));
  const rowUpdates: Array<{ item: MovePlanItem; downloadUrl: string | null }> = [];

  for (const item of items) {
    if (item.in_place) {
      rowUpdates.push({ item, downloadUrl: null });
      continue;
    }
    const update = updateById.get(item.id);
    const copiedPath = getFirebaseStoragePathFromDownloadUrl(update?.download_url);
    if (!update || copiedPath !== item.destination_path) {
      return {
        success: false,
        status: 400,
        error: `La copia de «${item.name}» no coincide con lo previsto. Recarga la página e inténtalo de nuevo.`,
      };
    }
    rowUpdates.push({ item, downloadUrl: update.download_url });
  }

  let transaction: Transaction | undefined;
  try {
    transaction = await tursoClient.transaction("write");
    for (const { item, downloadUrl } of rowUpdates) {
      await transaction.execute({
        sql: downloadUrl
          ? `
            UPDATE documentacion_files
            SET folder_name = ?, download_url = ?, preview_url = ?
            WHERE id = ?
          `
          : `UPDATE documentacion_files SET folder_name = ? WHERE id = ?`,
        args: downloadUrl
          ? [item.target_folder, downloadUrl, item.has_preview ? downloadUrl : null, item.id]
          : [item.target_folder, item.id],
      });
    }
    await transaction.commit();
    return { success: true, moved: rowUpdates.length };
  } catch (error) {
    if (transaction) await rollbackQuietly(transaction);
    console.error("Error committing document library move:", error);
    return {
      success: false,
      status: 500,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
