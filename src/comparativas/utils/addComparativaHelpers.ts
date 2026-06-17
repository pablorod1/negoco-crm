import { Client } from "@libsql/client";
import { ComparativaDB, ComparativaFile } from "../types";

const addComparativa = async (
  comparativa: ComparativaDB,
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    const query = `
      INSERT INTO comparativas (id, client, service, plan, comision_fijo, comision_indexado, comision_sales_person_fijo, comision_sales_person_indexado, notes, user_id, creation_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await tursoClient.execute({
      sql: query,
      args: [
        comparativa.id,
        comparativa.client,
        comparativa.service,
        JSON.stringify(comparativa.plan),
        comparativa.comision.fijo,
        comparativa.comision.indexado,
        comparativa.comision_sales_person.fijo,
        comparativa.comision_sales_person.indexado,
        JSON.stringify(comparativa.notes),
        comparativa.user_id,
        comparativa.creation_date,
        comparativa.status,
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

export const addComparativaFiles = async (
  files: ComparativaFile[],
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    const query = `
      INSERT INTO comparativa_files (id, comparativa_id, filename, size, extension, upload_date, download_url, preview_url)
      VALUES ${files.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
    `;

    const params = files.flatMap((file) => [
      file.id,
      file.comparativa_id,
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
