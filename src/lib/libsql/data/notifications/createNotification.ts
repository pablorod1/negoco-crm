import { Notification } from "@/lib/core/types";
import { tursoClient } from "../../client";

export const createNotification = async (
  notification: Notification
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Primero verificamos si ya existe una notificación con este ID
    const checkExisting = await tursoClient.execute({
      sql: `SELECT id FROM notifications WHERE id = ?`,
      args: [notification.id],
    });

    // Si existe, actualizamos en lugar de insertar
    if (checkExisting.rows && checkExisting.rows.length > 0) {
      const updateResponse = await tursoClient.execute({
        sql: `
          UPDATE notifications 
          SET title = ?, message = ?, context = ?, priority = ?, link = ?, user_id = ?
          WHERE id = ?`,
        args: [
          notification.title,
          notification.message,
          notification.context,
          notification.priority,
          notification.link as string,
          notification.user_id,
          notification.id,
        ],
      });

      if (updateResponse.rowsAffected === 0) {
        return { success: false, error: "Error al actualizar la notificación" };
      }

      return { success: true };
    }

    // Si no existe, creamos una nueva notificación
    const insertResponse = await tursoClient.execute({
      sql: `
        INSERT INTO notifications (id, title, message, context, priority, link, user_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        notification.id,
        notification.title,
        notification.message,
        notification.context,
        notification.priority,
        notification.link as string,
        notification.user_id,
      ],
    });

    if (insertResponse.rowsAffected === 0) {
      return { success: false, error: "Error al crear la notificación" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error al crear/actualizar la notificación:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};
