export const normalizedDocumentLibraryFolderNameSql = `
  rtrim(
    trim(
      replace(
        replace(
          replace(
            replace(folder_name, ' /', '/'),
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
