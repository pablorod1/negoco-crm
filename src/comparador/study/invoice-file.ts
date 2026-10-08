import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type { ProposalUploader } from "./close";

/**
 * La factura que se sube al hacer el estudio pasa a los documentos de la
 * comparativa (como hace el PDF de la propuesta al completar): queda en la
 * ficha, se puede abrir desde el estudio y sirve para el trámite. Solo se
 * guarda si el análisis ha salido bien.
 */
export async function attachUploadedInvoice({
  client,
  comparativaId,
  studyId,
  invoice,
  userId,
  upload,
}: {
  client: Pick<Client, "execute" | "batch">;
  comparativaId: string;
  /** El estudio que enlaza este documento como su factura; null para las demás páginas. */
  studyId: string | null;
  invoice: { data: Uint8Array; fileName: string; mime: string };
  userId: string;
  upload: ProposalUploader;
}): Promise<string> {
  const organization = await client.execute("SELECT id FROM organization LIMIT 1");
  const organizationId = String(organization.rows[0]?.id ?? "");
  if (!organizationId) throw new Error("Tenant without organization");

  const fileId = randomUUID();
  const fileName = invoice.fileName.replace(/[^\p{L}\p{N} ._()+-]/gu, "_") || "factura";
  const extension = (fileName.split(".").pop() ?? "pdf").toLowerCase();
  const stored = await upload({
    path: `${organizationId}/comparativas/${comparativaId}/${fileId}-${fileName}`,
    data: invoice.data,
    contentType: invoice.mime || "application/octet-stream",
  });
  const now = new Date().toISOString();
  try {
    await client.batch(
      [
        {
          sql: `INSERT INTO comparativa_files
            (id, comparativa_id, filename, size, extension, upload_date, download_url, preview_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
          args: [fileId, comparativaId, fileName, invoice.data.byteLength, extension, now, stored.downloadUrl],
        },
        {
          sql: `INSERT INTO comparativa_changes
            (id, comparativa_id, user_id, change_type, field_name, old_value, new_value, description, created_at)
            VALUES (?, ?, ?, 'document_upload', 'filename', NULL, ?, ?, ?)`,
          args: [randomUUID(), comparativaId, userId, fileName, `Documento subido: ${fileName}`, now],
        },
        ...(studyId
          ? [
              {
                sql: "UPDATE comparison_studies SET invoice_file_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                args: [fileId, studyId],
              },
            ]
          : []),
      ],
      "write",
    );
  } catch (error) {
    await stored.remove().catch(() => undefined);
    throw error;
  }
  return fileId;
}
