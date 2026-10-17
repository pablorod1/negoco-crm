import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { StudyError } from "./errors";

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

/** Estados en los que la comparativa espera su estudio. */
export const OPEN_STATUSES = ["pending", "processing"];

/**
 * Pasa la comparativa de luz a gas o al revés, cuando el comercial la creó
 * con el servicio que no era y la factura lo delata. El segmento de comisión
 * cambia como al editar el servicio en el CRM: «gas» en gas; en luz, sin
 * segmento hasta que se sepa la tarifa. Solo mientras espera su estudio.
 */
export async function switchComparativaService(
  client: Pick<Client, "transaction">,
  { comparativaId, service, userId }: { comparativaId: string; service: "Luz" | "Gas"; userId: string },
): Promise<void> {
  const transaction = await client.transaction("write");
  try {
    const { rows } = await transaction.execute({
      sql: "SELECT service, status, commission_segment FROM comparativas WHERE id = ? LIMIT 1",
      args: [comparativaId],
    });
    const previous = rows[0];
    if (!previous) throw new StudyError("Comparativa no encontrada", 404);
    if (String(previous.service) === service) {
      await transaction.rollback();
      return;
    }
    if (!OPEN_STATUSES.includes(String(previous.status))) {
      throw new StudyError("La comparativa ya no está pendiente de estudio: no se puede cambiar de luz a gas.", 409);
    }
    const segment = service === "Gas" ? "gas" : previous.commission_segment === "gas" ? null : undefined;
    await transaction.execute({
      sql:
        segment === undefined
          ? "UPDATE comparativas SET service = ? WHERE id = ?"
          : "UPDATE comparativas SET service = ?, commission_segment = ?, commission_segment_origin = ? WHERE id = ?",
      args: segment === undefined ? [service, comparativaId] : [service, segment, segment ? "service" : null, comparativaId],
    });
    await transaction.execute({
      sql: `INSERT INTO comparativa_changes
        (id, comparativa_id, user_id, change_type, field_name, old_value, new_value, description, created_at)
        VALUES (?, ?, ?, 'service_update', 'service', ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        comparativaId,
        userId,
        String(previous.service),
        service,
        `Servicio actualizado de "${String(previous.service)}" a "${service}" por la factura del estudio Negoco Cloud`,
        new Date().toISOString(),
      ],
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  } finally {
    transaction.close();
  }
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
