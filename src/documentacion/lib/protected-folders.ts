import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";
import { supplierFolderKey } from "./supplier-folders";

/**
 * La carpeta raíz de cada comercializadora activa es fija: no se mueve, no se
 * renombra y no se borra (ni desde la UI ni por API). Sus subcarpetas y
 * ficheros sí. Cuando la comercializadora se desactiva, la carpeta vuelve a
 * ser una carpeta normal.
 */
export function isProtectedSupplierFolder(
  folderPath: string,
  activeSupplierNames: string[]
): boolean {
  const path = normalizeDocumentLibraryFolderPath(folderPath);
  if (path === "/" || path.includes("/")) return false;

  const key = supplierFolderKey(path);
  return activeSupplierNames.some((name) => supplierFolderKey(name) === key);
}

export const PROTECTED_FOLDER_MESSAGE =
  "La carpeta de una comercializadora activa no se puede mover, renombrar ni eliminar.";
