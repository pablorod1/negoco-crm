import { ref, listAll, deleteObject } from "firebase/storage";
import { tursoClient } from "../../client";
import { storage } from "@/firebaseConfig";

export const deleteTramite = async (
  tramite_id: string,
  client_id: string
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // 1. Primero, eliminar archivos en Firebase Storage
    const storageRef = ref(storage, `tramites/${tramite_id}`);

    try {
      // Listar todos los archivos en la carpeta
      const fileList = await listAll(storageRef);

      // Eliminar cada archivo
      const deletePromises = fileList.items.map((fileRef) =>
        deleteObject(fileRef)
      );
      await Promise.all(deletePromises);
    } catch (storageError) {
      console.error("Error al eliminar archivos:", storageError);
      // Si falla la eliminación de archivos, abortar toda la operación
      return {
        success: false,
        error: "Error al eliminar los archivos asociados al trámite",
      };
    }

    // 2. Solo si se eliminaron los archivos correctamente, eliminar el trámite de la base de datos
    const response = await tursoClient.execute({
      sql: `DELETE FROM tramites WHERE id = ?`,
      args: [tramite_id],
    });

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "No se encontró el trámite",
      };
    }

    const clientResponse = await tursoClient.execute({
      sql: `DELETE FROM clients WHERE id = ?`,
      args: [client_id],
    });

    if (clientResponse.rowsAffected === 0) {
      return {
        success: false,
        error: "No se encontró el cliente",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al eliminar trámite:", error);
    return {
      success: false,
      error: "Error al eliminar trámite",
    };
  }
};
