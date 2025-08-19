/**
 * Centralized Notifications API Service
 *
 * This service provides a unified interface for all notification operations,
 * ensuring consistent error handling and request formatting across the application.
 */

import { Notification } from "@/core/types";

interface NotificationServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class NotificationsService {
  private readonly baseUrl = "/api/v2/notifications";

  /**
   * Creates a new notification
   * @param notification - The notification object to create
   * @returns Promise containing the API response
   */
  async create(
    notification: Notification
  ): Promise<NotificationServiceResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notification }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
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
   * Retrieves all notifications for a specific user
   * @param userId - The ID of the user to fetch notifications for
   * @returns Promise containing the API response with notification data
   */
  async getByUserId(
    userId: string
  ): Promise<NotificationServiceResponse<Notification[]>> {
    try {
      const response = await fetch(
        `${this.baseUrl}?user_id=${encodeURIComponent(userId)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch notifications",
      };
    }
  }

  /**
   * Deletes a single notification by ID
   * @param id - The ID of the notification to delete
   * @returns Promise containing the API response
   */
  async deleteById(id: string): Promise<NotificationServiceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error deleting notification:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete notification",
      };
    }
  }

  /**
   * Deletes multiple notifications by their IDs
   * @param ids - Array of notification IDs to delete
   * @returns Promise containing the API response
   */
  async deleteMultiple(ids: string[]): Promise<NotificationServiceResponse> {
    try {
      if (!ids.length) {
        throw new Error("No notification IDs provided");
      }

      const response = await fetch(this.baseUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error deleting multiple notifications:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete notifications",
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

// Export a singleton instance for use across the application
export const notificationsService = new NotificationsService();

// Export the class for testing purposes
export default NotificationsService;
