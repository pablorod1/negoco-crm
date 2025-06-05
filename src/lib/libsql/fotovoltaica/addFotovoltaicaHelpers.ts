import { extractCoordinatesFromUrl } from "@/lib/core/extraxtCoordinates";
import { FotovoltaicaDB, FotovoltaicaFile } from "@/lib/core/types";
import { Client } from "@libsql/client";

export const addFotovoltaica = async (
  fotovoltaica: FotovoltaicaDB,
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    const query = `
      INSERT INTO fotovoltaica (id, client, client_type, location, coordinates, type, notes, internal_notes, user_id, creation_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const coordinates = extractCoordinatesFromUrl(fotovoltaica.location);

    await tursoClient.execute({
      sql: query,
      args: [
        fotovoltaica.id,
        fotovoltaica.client,
        fotovoltaica.client_type,
        fotovoltaica.location,
        JSON.stringify(coordinates),
        fotovoltaica.type,
        JSON.stringify(fotovoltaica.notes || []),
        JSON.stringify(fotovoltaica.internal_notes || []),
        fotovoltaica.user_id,
        fotovoltaica.creation_date,
        fotovoltaica.status,
      ],
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al añadir comparativa:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

export const addFotovoltaicaFiles = async (
  files: FotovoltaicaFile[],
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    const query = `
      INSERT INTO fotovoltaica_files (id, fotovoltaica_id, filename, size, extension, upload_date, download_url, preview_url)
      VALUES ${files.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
    `;

    const params = files.flatMap((file) => [
      file.id,
      file.fotovoltaica_id,
      file.filename,
      file.size,
      file.extension,
      file.upload_date,
      file.download_url,
      file.preview_url || null,
    ]);

    await tursoClient.execute({
      sql: query,
      args: params,
    });

    return { success: true };
  } catch (error) {
    console.error("Error al añadir archivos de comparativa:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};
