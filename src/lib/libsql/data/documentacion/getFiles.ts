import { tursoClient } from "../../client";

export const getFilesFromFolder = async (folder_name: string) => {
  try {
    const response = await tursoClient().execute({
      sql: `
        SELECT id, name, size, extension, upload_date, download_url, preview_url, type
        FROM documentacion_files
        WHERE folder_name = ?
      `,
      args: [folder_name],
    });

    return response.rows.map((row) => ({
      id: row[0],
      name: row[1],
      size: row[2],
      extension: row[3],
      upload_date: row[4],
      download_url: row[5],
      preview_url: row[6],
      folder_name,
      type: row[7],
    }));
  } catch (error) {
    console.error("Error obteniendo archivos:", error);
    throw error;
  }
};

export const getRecentlyFiles = async () => {
  try {
    const response = await tursoClient().execute(
      `
        SELECT id, name, size, extension, upload_date, download_url, preview_url, type, folder_name
        FROM documentacion_files
        ORDER BY upload_date DESC
        LIMIT 5
      `
    );

    return response.rows.map((row) => ({
      id: row[0],
      name: row[1],
      size: row[2],
      extension: row[3],
      upload_date: row[4],
      download_url: row[5],
      preview_url: row[6],
      type: row[7],
      folder_name: row[8],
    }));
  } catch (error) {
    console.error("Error obteniendo archivos recientes:", error);
    throw error;
  }
};

export const getFilesByName = async (name: string) => {
  try {
    const response = await tursoClient().execute({
      sql: `
        SELECT id, name, size, extension, upload_date, download_url, preview_url, type, folder_name
        FROM documentacion_files
        WHERE name LIKE ?
      `,
      args: [`%${name}%`],
    });

    return response.rows.map((row) => ({
      id: row[0],
      name: row[1],
      size: row[2],
      extension: row[3],
      upload_date: row[4],
      download_url: row[5],
      preview_url: row[6],
      type: row[7],
      folder_name: row[8],
    }));
  } catch (error) {
    console.error("Error obteniendo archivos por nombre:", error);
    throw error;
  }
};
