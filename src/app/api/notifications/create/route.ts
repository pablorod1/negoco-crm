import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { Notification } from "@/core/types";

export async function POST(req: NextRequest) {
  try {
    const { notification }: { notification: Notification } = await req.json();

    if (!notification) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

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

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        { error: "Database client not initialized" },
        { status: 500 }
      );
    }

    const checkExisting = await tursoClient.execute({
      sql: `SELECT id FROM notifications WHERE id = ?`,
      args: [id],
    });

    if (checkExisting.rows && checkExisting.rows.length > 0) {
      const updateResponse = await tursoClient.execute({
        sql: `
              UPDATE notifications 
              SET title = ?, message = ?, context = ?, priority = ?, link = ?, user_id = ?
              WHERE id = ?`,
        args: [title, message, context, priority, link, user_id, id],
      });

      if (updateResponse.rowsAffected === 0) {
        return NextResponse.json(
          { error: "Error al actualizar la notificación" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Validate the 'client' field and ensure null values are handled explicitly
    const sanitizedClient =
      client !== undefined && client !== null ? client : null;

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
        link,
        user_id,
        created_at,
        sanitizedClient, // Use sanitized value for 'client'
      ],
    });

    if (insertResponse.rowsAffected === 0) {
      return NextResponse.json(
        { error: "Error al crear la notificación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
