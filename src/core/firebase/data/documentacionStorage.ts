import {
  deleteObject,
  getMetadata,
  listAll,
  ref,
  type StorageReference,
} from "firebase/storage";
import { storage } from "@/core/firebase/firebaseConfig";
import {
  getFirebaseStoragePathFromDownloadUrl,
  normalizeDocumentLibraryFolderPath,
} from "@/core/utils/document-library-path";

/** `org/documentacion[/carpeta[/fichero]]` */
export function documentacionStoragePath(
  organizationId: string,
  folderPath?: string | null,
  fileName?: string
): string {
  const folder = normalizeDocumentLibraryFolderPath(folderPath);
  return [organizationId, "documentacion", folder === "/" ? "" : folder, fileName]
    .filter((segment): segment is string => Boolean(segment))
    .join("/");
}

/** Todos los objetos bajo un prefijo, subcarpetas incluidas. */
export async function listDocumentacionObjects(
  storagePath: string
): Promise<StorageReference[]> {
  const result = await listAll(ref(storage, storagePath));
  const nested = await Promise.all(
    result.prefixes.map((prefix) => listDocumentacionObjects(prefix.fullPath))
  );
  return [...result.items, ...nested.flat()];
}

export async function storageObjectExists(storagePath: string): Promise<boolean> {
  try {
    await getMetadata(ref(storage, storagePath));
    return true;
  } catch (error) {
    if (isObjectNotFound(error)) return false;
    throw error;
  }
}

export function isObjectNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "storage/object-not-found"
  );
}

/** Borrado tolerante: los objetos que ya no existen no cuentan como error. */
export async function deleteStorageObjects(
  refs: StorageReference[],
  context: string
): Promise<void> {
  const results = await Promise.allSettled(refs.map((r) => deleteObject(r)));
  results.forEach((result, index) => {
    if (result.status === "rejected" && !isObjectNotFound(result.reason)) {
      console.error(
        `[${context}] No se pudo borrar ${refs[index].fullPath}:`,
        result.reason
      );
    }
  });
}

/** Referencia al objeto de un fichero de Documentación a partir de su fila. */
export function documentacionFileRef(
  organizationId: string,
  file: { name: string; folder_name: string; download_url: string | null }
): StorageReference {
  const pathFromUrl = getFirebaseStoragePathFromDownloadUrl(file.download_url);
  return ref(
    storage,
    pathFromUrl ??
      documentacionStoragePath(organizationId, file.folder_name, file.name)
  );
}
