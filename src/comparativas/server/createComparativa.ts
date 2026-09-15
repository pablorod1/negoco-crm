import type { Client, Row, Transaction } from "@libsql/client";
import type { ComparativaDB, ComparativaFile } from "@/comparativas/types";

export class ComparativaIdempotencyConflictError extends Error {
  constructor(id: string) {
    super(`Comparison idempotency key ${id} belongs to another creation`);
    this.name = "ComparativaIdempotencyConflictError";
  }
}

function hasSameCreationIdentity(row: Row, comparativa: ComparativaDB): boolean {
  return (
    String(row.user_id) === comparativa.user_id &&
    String(row.creation_date) === comparativa.creation_date
  );
}

function hasSameFileData(row: Row, file: ComparativaFile): boolean {
  return (
    String(row.comparativa_id) === file.comparativa_id &&
    String(row.filename) === file.filename &&
    Number(row.size) === file.size &&
    String(row.extension) === file.extension &&
    String(row.upload_date) === file.upload_date &&
    String(row.download_url) === file.download_url &&
    (row.preview_url === null ? null : String(row.preview_url)) ===
      file.preview_url
  );
}

async function insertComparativa(
  transaction: Transaction,
  comparativa: ComparativaDB,
): Promise<void> {
  await transaction.execute({
    sql: `INSERT INTO comparativas (
      id, client, service, plan, comision_fijo, comision_indexado,
      comision_sales_person_fijo, comision_sales_person_indexado,
      notes, user_id, creation_date, status, tramite_id, company_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      comparativa.id,
      comparativa.client,
      comparativa.service,
      JSON.stringify(comparativa.plan),
      comparativa.comision.fijo,
      comparativa.comision.indexado,
      comparativa.comision_sales_person.fijo,
      comparativa.comision_sales_person.indexado,
      JSON.stringify(comparativa.notes),
      comparativa.user_id,
      comparativa.creation_date,
      comparativa.status,
      comparativa.tramite_id ?? null,
      null,
    ],
  });
}

async function ensureCreationAudit(
  transaction: Transaction,
  comparativa: ComparativaDB,
): Promise<void> {
  await transaction.execute({
    sql: `INSERT INTO comparativa_changes (
      id, comparativa_id, user_id, change_type, field_name,
      old_value, new_value, description, created_at
    )
    SELECT ?, ?, ?, 'created', NULL, NULL, NULL, ?, ?
    WHERE NOT EXISTS (
      SELECT 1
      FROM comparativa_changes
      WHERE comparativa_id = ? AND change_type = 'created'
    )`,
    args: [
      crypto.randomUUID(),
      comparativa.id,
      comparativa.user_id,
      `Comparativa creada para el cliente ${comparativa.client}`,
      new Date().toISOString(),
      comparativa.id,
    ],
  });
}

async function ensureComparativaFile(
  transaction: Transaction,
  file: ComparativaFile,
): Promise<void> {
  const existingResult = await transaction.execute({
    sql: `SELECT comparativa_id, filename, size, extension, upload_date,
      download_url, preview_url
    FROM comparativa_files
    WHERE id = ?`,
    args: [file.id],
  });
  const existing = existingResult.rows[0];

  if (existing) {
    if (!hasSameFileData(existing, file)) {
      throw new ComparativaIdempotencyConflictError(file.id);
    }
    return;
  }

  await transaction.execute({
    sql: `INSERT INTO comparativa_files (
      id, comparativa_id, filename, size, extension, upload_date,
      download_url, preview_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      file.id,
      file.comparativa_id,
      file.filename,
      file.size,
      file.extension,
      file.upload_date,
      file.download_url,
      file.preview_url,
    ],
  });
}

/**
 * The client-generated comparison ID identifies one creation attempt. A write
 * transaction serializes concurrent retries and makes all related rows atomic.
 */
export async function createComparativaIdempotently(
  client: Client,
  comparativa: ComparativaDB,
  files: ComparativaFile[],
): Promise<{ created: boolean }> {
  const transaction = await client.transaction("write");

  try {
    const existingResult = await transaction.execute({
      sql: `SELECT user_id, creation_date
        FROM comparativas
        WHERE id = ?`,
      args: [comparativa.id],
    });
    const existing = existingResult.rows[0];

    if (existing && !hasSameCreationIdentity(existing, comparativa)) {
      throw new ComparativaIdempotencyConflictError(comparativa.id);
    }

    if (!existing) {
      await insertComparativa(transaction, comparativa);
    }

    await ensureCreationAudit(transaction, comparativa);
    for (const file of files) {
      await ensureComparativaFile(transaction, file);
    }

    await transaction.commit();
    return { created: !existing };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Comparison creation and transaction rollback both failed",
      );
    }
    throw error;
  } finally {
    transaction.close();
  }
}
