import { Client } from "@libsql/client";

export const getSubcomerciales = async (tursoClient: Client, id: string) => {
  try {
    const response = await tursoClient.execute({
      sql: `
        WITH RECURSIVE subcomerciales AS (
          SELECT id FROM user WHERE id = ?
          UNION ALL
          SELECT u.id
          FROM user u
          INNER JOIN subcomerciales s ON u.super_id = s.id
        )
        SELECT id FROM subcomerciales WHERE id != ?;
      `,
      args: [id, id],
    });

    if (response.rows.length === 0) {
      return {
        success: false,
        error: "No subcomerciales found",
      };
    }

    const ids = response.rows.map((row) => row.id as string);
    return {
      success: true,
      ids,
    };
  } catch (error) {
    console.error("Error fetching subcomerciales:", error);
    return {
      success: false,
      error: "Error fetching subcomerciales",
    };
  }
};
