import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/libsql/client";
import { Notification } from "@/lib/core/types";

export async function POST(req: NextRequest) {
  try {
    const { notification }: { notification: Notification } = await req.json();

    if (!notification) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const { id, title, message, context, priority, link, user_id, created_at } =
      notification;

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

    const insertResponse = await tursoClient.execute({
      sql: `
            INSERT INTO notifications (id, title, message, context, priority, link, user_id, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, title, message, context, priority, link, user_id, created_at],
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
