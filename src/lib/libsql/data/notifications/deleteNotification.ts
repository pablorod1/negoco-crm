import { tursoClient } from "../../client";

export const deleteNotification = async (id: string) => {
  try {
    const response = await tursoClient.execute({
      sql: `DELETE FROM notifications WHERE id = ?`,
      args: [id],
    });

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "No se ha podido eliminar la notificación",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting notification", error);
    return {
      success: false,
      error: "Error desconocido eliminando la notificación",
    };
  }
};
