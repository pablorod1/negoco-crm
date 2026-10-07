import type { Client } from "@libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

type QueryClient = Pick<Client, "execute">;

export interface StudyComparativa {
  id: string;
  service: string;
  hasRenovacion: boolean;
}

export interface ComparativaPdf {
  id: string;
  filename: string;
  uploadDate: string;
  downloadUrl: string;
}

/**
 * La comparativa si este usuario puede verla, con la misma regla que el CRM:
 * un comercial (rol 2) solo ve las suyas y las de sus subcomerciales.
 */
export async function getStudyComparativa(
  client: QueryClient,
  id: string,
  user: { id: string; role: string },
): Promise<StudyComparativa | null> {
  const args: string[] = [id];
  let sql = "SELECT id, service, has_renovacion FROM comparativas WHERE id = ?";
  if (user.role === "2") {
    const owners = [user.id];
    const subcomerciales = await getSubcomerciales(client as Client, user.id);
    if (subcomerciales.success) owners.push(...subcomerciales.ids);
    sql += ` AND user_id IN (${owners.map(() => "?").join(", ")})`;
    args.push(...owners);
  }
  const { rows } = await client.execute({ sql: `${sql} LIMIT 1`, args });
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    service: String(row.service),
    hasRenovacion: Number(row.has_renovacion ?? 0) === 1,
  };
}

/** Los PDF adjuntos a la comparativa, el más reciente primero. */
export async function listComparativaPdfs(
  client: QueryClient,
  comparativaId: string,
): Promise<ComparativaPdf[]> {
  const { rows } = await client.execute({
    sql: `SELECT id, filename, upload_date, download_url FROM comparativa_files
      WHERE comparativa_id = ? AND (lower(extension) IN ('pdf', '.pdf') OR lower(filename) LIKE '%.pdf')
      ORDER BY upload_date DESC`,
    args: [comparativaId],
  });
  return rows.map((row) => ({
    id: String(row.id),
    filename: String(row.filename),
    uploadDate: String(row.upload_date),
    downloadUrl: String(row.download_url),
  }));
}
