export const DOCUMENT_LIBRARY_ROOT_FOLDER = "/";

export function normalizeDocumentLibraryFolderPath(
  folderPath?: string | null
): string {
  const normalizedPath = (folderPath ?? "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

  return normalizedPath || DOCUMENT_LIBRARY_ROOT_FOLDER;
}

export function getDocumentLibraryStorageFolderName(
  folderPath?: string | null
): string | undefined {
  const normalizedPath = normalizeDocumentLibraryFolderPath(folderPath);

  return normalizedPath === DOCUMENT_LIBRARY_ROOT_FOLDER
    ? undefined
    : normalizedPath;
}

export function normalizeDocumentLibraryFolderPaths(paths: string[]): string[] {
  const normalizedPaths = new Set<string>();

  paths.forEach((path) => {
    const normalizedPath = normalizeDocumentLibraryFolderPath(path);
    if (normalizedPath !== DOCUMENT_LIBRARY_ROOT_FOLDER) {
      normalizedPaths.add(normalizedPath);
    }
  });

  return Array.from(normalizedPaths);
}
