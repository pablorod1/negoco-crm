import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { Notification } from "@/core/types";

/**
 * Zod validation schemas for request/response validation
 */
const NotificationSchema = z.object({
  id: z.string().min(1, "ID is required"),
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  context: z.string().min(1, "Context is required"),
  priority: z.number().int().min(0).max(5, "Priority must be between 0-5"),
  link: z.string().optional(),
  user_id: z.string().min(1, "User ID is required"),
  created_at: z.string().min(1, "Created at is required"),
  client: z.string().optional().nullable(),
});

const CreateNotificationRequestSchema = z.object({
  notification: NotificationSchema,
});

// Note: GET requests use query parameters, so this schema is for reference only
// const GetNotificationsRequestSchema = z.object({
//   id: z.string().min(1, "User ID is required"),
// });

const DeleteAllNotificationsRequestSchema = z.object({
  ids: z.array(z.string().min(1, "ID is required")).min(1, "At least one ID is required"),
});

/**
 * Response interfaces for type safety
 */
interface NotificationResponse {
  success: boolean;
  data?: Notification[];
  error?: string;
}

interface SuccessResponse {
  success: boolean;
  error?: string;
}

/**
 * Creates a new notification or updates an existing one
 * @param request - Next.js request object containing notification data
 * @returns Promise<NextResponse<SuccessResponse>>
 */
export async function POST(request: NextRequest): Promise<NextResponse<SuccessResponse>> {
  try {
    const body = await request.json();
    
    // Validate request body using Zod
    const validationResult = CreateNotificationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Validation failed: ${validationResult.error.errors.map(e => e.message).join(', ')}` 
        },
        { status: 400 }
      );
    }

    const { notification } = validationResult.data;
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

    // Get database client with error handling
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

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
        return NextResponse.json(
          { success: false, error: "Error al actualizar la notificación" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Sanitize client field to handle null/undefined values
    const sanitizedClient = client !== undefined && client !== null ? client : null;

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
      return NextResponse.json(
        { success: false, error: "Error al crear la notificación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /new_api/notifications:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Retrieves notifications for a specific user
 * @param request - Next.js request object containing user ID
 * @returns Promise<NextResponse<NotificationResponse>>
 */
export async function GET(request: NextRequest): Promise<NextResponse<NotificationResponse>> {
  try {
    // Parse query parameters for GET request
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing user_id parameter" },
        { status: 400 }
      );
    }

    // Validate user ID
    const userIdValidation = z.string().min(1).safeParse(userId);
    if (!userIdValidation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid user_id parameter" },
        { status: 400 }
      );
    }

    // Get database client with error handling
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Fetch notifications with optimized query (add ORDER BY for consistent results)
    const response = await tursoClient.execute({
      sql: `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
      args: [userId],
    });

    if (response.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Map database rows to Notification objects with proper typing
    const notifications: Notification[] = response.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      message: row.message as string,
      context: row.context as string,
      priority: row.priority as number,
      created_at: row.created_at as string,
      link: row.link as string,
      user_id: row.user_id as string,
      client: row.client as string | undefined,
    }));

    return NextResponse.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error in GET /new_api/notifications:", error);
    return NextResponse.json(
      { success: false, error: "Error fetching notifications" },
      { status: 500 }
    );
  }
}

/**
 * Deletes all notifications specified by IDs
 * @param request - Next.js request object containing array of notification IDs
 * @returns Promise<NextResponse<SuccessResponse>>
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<SuccessResponse>> {
  try {
    const body = await request.json();
    
    // Validate request body using Zod
    const validationResult = DeleteAllNotificationsRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Validation failed: ${validationResult.error.errors.map(e => e.message).join(', ')}` 
        },
        { status: 400 }
      );
    }

    const { ids } = validationResult.data;

    // Get database client with error handling
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 }
      );
    }

    // Build parameterized query to prevent SQL injection
    const placeholders = ids.map(() => "?").join(",");
    const response = await tursoClient.execute({
      sql: `DELETE FROM notifications WHERE id IN (${placeholders})`,
      args: ids,
    });

    if (response.rowsAffected === 0) {
      return NextResponse.json(
        { success: false, error: "No notifications found with provided IDs" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /new_api/notifications:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
