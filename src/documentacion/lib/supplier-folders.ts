import { ComercializadoraVM } from "@/comercializadoras/types";
import { normalizeDocumentLibraryFolderPath } from "@/core/utils/document-library-path";

/**
 * Cada comercializadora activa tiene su carpeta en la raíz de Documentación.
 *
 * En Storage una carpeta sólo existe cuando contiene algo, así que las de las
 * comercializadoras sin documentos se pintan como carpetas "virtuales" y la
 * real se crea con la primera subida. Los tenants ya tenían carpetas creadas a
 * mano (`TOTALENERGIES`, `Endesa `…), por lo que el emparejamiento con la
 * comercializadora es tolerante a mayúsculas, acentos, espacios y signos.
 */
export interface SupplierFolder {
  /** Nombre real de la carpeta si existe; el de la comercializadora si no. */
  folderName: string;
  supplier: ComercializadoraVM;
  /** `false` cuando la carpeta aún no existe en Storage. */
  exists: boolean;
}

export function supplierFolderKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Reparte las carpetas de primer nivel entre las que pertenecen a una
 * comercializadora activa y el resto, y añade como virtuales las
 * comercializadoras que todavía no tienen carpeta.
 */
export function splitSupplierFolders(
  folders: string[],
  suppliers: ComercializadoraVM[]
): { supplierFolders: SupplierFolder[]; otherFolders: string[] } {
  const foldersByKey = new Map<string, string>();
  folders.forEach((folder) => {
    const key = supplierFolderKey(folder);
    if (key && !foldersByKey.has(key)) foldersByKey.set(key, folder);
  });

  const claimedFolders = new Set<string>();
  const supplierFolders = suppliers
    .filter((supplier) => supplier.active)
    .map((supplier): SupplierFolder => {
      const existing = foldersByKey.get(supplierFolderKey(supplier.name));
      if (existing !== undefined) claimedFolders.add(existing);
      return {
        folderName:
          existing ?? normalizeDocumentLibraryFolderPath(supplier.name),
        supplier,
        exists: existing !== undefined,
      };
    })
    .sort((a, b) =>
      a.supplier.name.localeCompare(b.supplier.name, "es", {
        sensitivity: "base",
      })
    );

  return {
    supplierFolders,
    otherFolders: folders.filter((folder) => !claimedFolders.has(folder)),
  };
}

/**
 * Resuelve la carpeta de una comercializadora concreta a partir de las
 * carpetas de primer nivel: la real si existe, o su nombre si aún no.
 */
export function resolveSupplierFolderName(
  folders: string[],
  supplierName: string
): { folderName: string; exists: boolean } {
  const key = supplierFolderKey(supplierName);
  const existing = folders.find((folder) => supplierFolderKey(folder) === key);
  return {
    folderName: existing ?? normalizeDocumentLibraryFolderPath(supplierName),
    exists: existing !== undefined,
  };
}
