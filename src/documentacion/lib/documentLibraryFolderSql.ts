export function getNormalizedDocumentLibraryFolderNameSql(
  column: string = "folder_name"
) {
  return `
  rtrim(
    trim(
      replace(
        replace(
          replace(
            replace(${column}, ' /', '/'),
            '/ ',
            '/'
          ),
          ' /',
          '/'
        ),
        '/ ',
        '/'
      )
    ),
    '/'
  )
`;
}

/**
 * Condición "la fila está en esta carpeta o en cualquiera de sus subcarpetas".
 * Espera dos argumentos: la ruta normalizada y esa misma ruta con `/%`.
 */
export function getDocumentLibraryFolderSubtreeSql(
  column: string = "folder_name"
) {
  const normalized = getNormalizedDocumentLibraryFolderNameSql(column);
  return `(${normalized} = ? OR ${normalized} LIKE ? ESCAPE '\\')`;
}

/** Argumentos para `getDocumentLibraryFolderSubtreeSql`. */
export function getDocumentLibraryFolderSubtreeArgs(
  normalizedFolderPath: string
): [string, string] {
  const escaped = normalizedFolderPath.replace(/[\\%_]/g, (char) => `\\${char}`);
  return [normalizedFolderPath, `${escaped}/%`];
}
