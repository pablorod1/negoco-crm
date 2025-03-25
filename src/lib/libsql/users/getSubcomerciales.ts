import { Client } from "@libsql/client";

export const getSubcomerciales = async (tursoClient: Client, id: string) => {
  try {
    const response = await tursoClient.execute({
      sql: "SELECT id FROM user WHERE super_id = ?;",
      args: [id],
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
