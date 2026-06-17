import { Client } from "@libsql/client";
import {
  ref,
  listAll,
  getDownloadURL,
  uploadBytes,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebaseConfig";
import { ComparativaFile } from "@/comparativas/types";

// Función para mover archivos en Firebase Storage
const moveFilesInFirebaseStorage = async (
  organization_id: string,
  comparativa_id: string,
  tramite_id: string
): Promise<{
  success: boolean;
  downloadURLs?: { url: string; name: string }[];
  error?: string;
}> => {
  try {
    // Ruta origen y destino
    const sourceDir = `${organization_id}/comparativas/${comparativa_id}`;
    const targetDir = `${organization_id}/tramites/${tramite_id}`;

    // Listar todos los archivos en el directorio de origen
    const sourceRef = ref(storage, sourceDir);
    const filesList = await listAll(sourceRef);

    // Si no hay archivos, devolver éxito
    if (filesList.items.length === 0) {
      return {
        success: false,
        error: `No hay archivos en firebase en el path ${sourceDir}`,
      };
    }

    const downloadURLs: { url: string; name: string }[] = [];

    // Mover cada archivo (descargar → subir a nueva ubicación → eliminar original)
    for (const fileRef of filesList.items) {
      // Obtener el nombre del archivo
      const fileName = fileRef.name;

      // Descargar el archivo como blob
      const downloadURL = await getDownloadURL(fileRef);
      const fileResponse = await fetch(downloadURL);
      const fileBlob = await fileResponse.blob();

      // Crear referencia a la nueva ubicación
      const newFileRef = ref(storage, `${targetDir}/${fileName}`);

      // Subir a la nueva ubicación
      await uploadBytes(newFileRef, fileBlob);

      // Obtener la URL de descarga del nuevo archivo
      const newDownloadURL = await getDownloadURL(newFileRef);
      downloadURLs.push({ url: newDownloadURL, name: fileName });
      // Eliminar el archivo original
      await deleteObject(fileRef);
    }
    return { success: true, downloadURLs };
  } catch (error) {
    console.error("Error moving files in Firebase Storage:", error);
    return { success: false, error: String(error) };
  }
};

// Función actualizada que integra la base de datos y el storage
export const moveFolderFromComparativasToTramites = async (
  tursoClient: Client,
  organization_id: string,
  comparativa_id: string,
  tramite_id: string
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // 1. Obtener todos los archivos relacionados con la comparativa
    const comparativaRows = await tursoClient.execute({
      sql: `SELECT * FROM comparativa_files WHERE comparativa_id = ?`,
      args: [comparativa_id],
    });

    if (comparativaRows.rows.length === 0) {
      return {
        success: false,
        error: `No hay archivos en la tabla comparativa_files para la comparativa ${comparativa_id}`,
      }; // No hay archivos para mover
    }

    const files: Partial<ComparativaFile>[] = comparativaRows.rows.map(
      (row) => ({
        id: row.id as string,
        filename: row.filename as string,
        size: row.size as number,
        extension: row.extension as string,
      })
    );

    // 3. Mover archivos en Firebase Storage
    const { success, downloadURLs, error } = await moveFilesInFirebaseStorage(
      organization_id,
      comparativa_id,
      tramite_id
    );
    if (!success) {
      return {
        success: false,
        error: `Error al mover archivos en Firebase Storage: ${error}`,
      };
    }
    // 2. Insertar cada archivo en la tabla tramite_files
    for (const file of files) {
      await tursoClient.execute({
        sql: `
          INSERT INTO tramite_files (id, filename, size, extension, upload_date, tramite_id, download_url, preview_url) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          file.id as string,
          file.filename as string,
          file.size as number,
          file.extension as string,
          new Date().toISOString(),
          tramite_id,
          downloadURLs?.find((f) => f.name === file.filename)?.url || "",
          null,
        ],
      });
    }

    // 4. Eliminar los archivos de la tabla comparativa_files
    const deletionResponse = await tursoClient.execute({
      sql: "DELETE FROM comparativa_files WHERE comparativa_id = ?",
      args: [comparativa_id],
    });

    if (deletionResponse.rowsAffected !== files.length) {
      return {
        success: false,
        error:
          "No se pudieron eliminar los archivos de la comparativa en la base de datos",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error moving folder:", error);
    return { success: false, error: String(error) };
  }
};
