/**
 * Server-side Notifications Service
 *
 * This service provides direct database operations for notifications
 * to be used in API routes and server-side code.
 */

import { Notification } from "@/core/types";
import { Client } from "@libsql/client";

interface NotificationServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ServerNotificationsService {
  /**
   * Creates a new notification directly in the database
   * @param notification - The notification object to create
   * @param tursoClient - Database client instance
   * @returns Promise containing the operation response
   */
  static async create(
    notification: Notification,
    tursoClient: Client
  ): Promise<NotificationServiceResponse> {
    try {
      const {
        id,
        title,
        message,
        context,
        priority,
        link,
        user_id,
        created_at,
        client,
      } = notification;

      // Sanitize client field to handle null/undefined values
      const sanitizedClient =
        client !== undefined && client !== null ? client : null;

      // Check if notification already exists (upsert pattern)
      const checkExisting = await tursoClient.execute({
        sql: `SELECT id FROM notifications WHERE id = ?`,
        args: [id],
      });

      if (checkExisting.rows && checkExisting.rows.length > 0) {
        // Update existing notification
        const updateResponse = await tursoClient.execute({
          sql: `
            UPDATE notifications 
            SET title = ?, message = ?, context = ?, priority = ?, link = ?, user_id = ?
            WHERE id = ?`,
          args: [title, message, context, priority, link || null, user_id, id],
        });

        if (updateResponse.rowsAffected === 0) {
          return {
            success: false,
            error: "Error al actualizar la notificación",
          };
        }

        return { success: true };
      }

      // Create new notification
      const insertResponse = await tursoClient.execute({
        sql: `
          INSERT INTO notifications (id, title, message, context, priority, link, user_id, created_at, client) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          title,
          message,
          context,
          priority,
          link || null,
          user_id,
          created_at,
          sanitizedClient,
        ],
      });

      if (insertResponse.rowsAffected === 0) {
        return {
          success: false,
          error: "Error al crear la notificación",
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Error creating notification:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create notification",
      };
    }
  }

  /**
   * Creates a notification helper for common notification patterns
   * @param params - Common notification parameters
   * @returns A Notification object ready to be created
   */
  static createNotificationObject({
    title,
    message,
    userId,
    context = "General",
    priority = 2,
    link,
    client,
  }: {
    title: string;
    message: string;
    userId: string;
    context?: string;
    priority?: number;
    link?: string;
    client?: string;
  }): Notification {
    return {
      id: `NOT-${crypto.randomUUID()}`,
      title,
      message,
      user_id: userId,
      context,
      priority,
      link: link || "",
      client: client || undefined,
      created_at: new Date().toISOString(),
    };
  }
}

// Export the class for use in server-side code
export default ServerNotificationsService;
