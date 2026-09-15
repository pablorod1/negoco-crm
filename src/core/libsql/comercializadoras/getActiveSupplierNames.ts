import type { Client } from "@libsql/client";

/** Nombres de las comercializadoras activas del tenant (carpetas protegidas). */
export async function getActiveSupplierNames(
  tursoClient: Client
): Promise<string[]> {
  const response = await tursoClient.execute({
    sql: "SELECT name FROM comercializadoras WHERE active = true",
    args: [],
  });

  return response.rows
    .map((row) => String(row.name ?? "").trim())
    .filter(Boolean);
}
