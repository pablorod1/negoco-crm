import { Client } from "@libsql/client";
import { executeReadWithRetry } from "@/core/libsql/executeWithRetry";

export const getSubcomerciales = async (tursoClient: Client, id: string) => {
  const response = await executeReadWithRetry(tursoClient, {
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

  const ids = response.rows.map((row) => row.id as string);
  return {
    success: true,
    ids,
  };
};
