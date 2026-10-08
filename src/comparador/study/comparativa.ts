import type { Client } from "@libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";

type QueryClient = Pick<Client, "execute">;

export interface StudyComparativa {
  id: string;
  service: string;
  hasRenovacion: boolean;
  /** Nombre del cliente tal como está en la comparativa; sale en el PDF. */
  clientName: string | null;
}

/** Un documento de la comparativa que puede ser la factura: PDF o foto. */
export interface ComparativaInvoiceFile {
  id: string;
  filename: string;
  /** Sin punto y en minúsculas: «pdf», «jpg»… */
  extension: string;
  uploadDate: string;
  downloadUrl: string;
}

/** Extensiones de factura que lee el estudio (las imágenes, con OCR). */
export const INVOICE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif", "tif", "tiff"];

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
  let sql = "SELECT id, service, has_renovacion, client FROM comparativas WHERE id = ?";
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
    clientName: typeof row.client === "string" && row.client.trim() ? row.client.trim() : null,
  };
}

/** Los documentos de la comparativa que pueden ser la factura (PDF o foto), el más reciente primero. */
export async function listComparativaInvoices(
  client: QueryClient,
  comparativaId: string,
): Promise<ComparativaInvoiceFile[]> {
  const { rows } = await client.execute({
    sql: `SELECT id, filename, extension, upload_date, download_url FROM comparativa_files
      WHERE comparativa_id = ?
      ORDER BY upload_date DESC`,
    args: [comparativaId],
  });
  return rows
    .map((row) => {
      const filename = String(row.filename);
      const extension = (String(row.extension ?? "").replace(/^\./, "") || filename.split(".").pop() || "").toLowerCase();
      return {
        id: String(row.id),
        filename,
        extension,
        uploadDate: String(row.upload_date),
        downloadUrl: String(row.download_url),
      };
    })
    // Las propuestas del propio estudio también son PDF, pero no son facturas.
    .filter(({ extension, filename }) => INVOICE_EXTENSIONS.includes(extension) && !/^Propuesta \d+ - /.test(filename));
}
