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
