import { Client } from "@libsql/client";

export async function deleteComparativa(tursoClient: Client, id: string) {
  try {
    const query = `DELETE FROM comparativas WHERE id = ?`;
    const response = await tursoClient.execute({
      sql: query,
      args: [id],
    });

    if (response.rowsAffected === 0) {
      return { success: false, error: "Comparativa not found" };
    }

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Internal Server Error" };
  }
}
