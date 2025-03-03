import { Notification } from "@/lib/core/types";
import { tursoClient } from "../../client";

export const getNotitications = async (
  user_id: string
): Promise<Notification[]> => {
  try {
    const response = await tursoClient.execute({
      sql: `SELECT * FROM notifications WHERE user_id = ?`,
      args: [user_id],
    });

    if (response.rows.length === 0) {
      return [];
    }

    return response.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      message: row.message as string,
      context: row.context as string,
      priority: row.priority as number,
      created_at: row.created_at as string,
      link: row.link as string,
      user_id: row.user_id as string,
    }));
  } catch (error) {
    console.error("Error fetching notifications", error);
    return [];
  }
};
