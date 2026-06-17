import type { Client } from "@libsql/client";
import { getTursoControlClient } from "@/core/libsql/client";
import type { ProcessingJob } from "./types";
import { addMinutes, getTenantInfoFromRequest } from "./utils";
import type { NextRequest } from "next/server";

export async function createProcessingJob({
  tenantSlug,
  tenantHost,
  tramiteId,
  processingDate,
  delayMinutes,
  controlClient = getTursoControlClient(),
}: {
  tenantSlug: string;
  tenantHost: string;
  tramiteId: string;
  processingDate: string;
  delayMinutes: number;
  controlClient?: Client;
}) {
  const processingDateValue = new Date(processingDate);
  if (Number.isNaN(processingDateValue.getTime())) {
    throw new Error("Invalid processing_date for CRM processing job");
  }

  const now = new Date().toISOString();
  const dueAt = addMinutes(processingDateValue, delayMinutes).toISOString();

  await controlClient.execute({
    sql: `INSERT OR IGNORE INTO crm_processing_jobs (
        id,
        tenant_slug,
        tenant_host,
        tramite_id,
        processing_date,
        due_at,
        status,
        attempts,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    args: [
      crypto.randomUUID(),
      tenantSlug,
      tenantHost,
      tramiteId,
      processingDate,
      dueAt,
      now,
      now,
    ],
  });
}

export async function createProcessingJobFromRequest({
  request,
  tramiteId,
  processingDate,
  delayMinutes,
}: {
  request: NextRequest;
  tramiteId: string;
  processingDate: string;
  delayMinutes: number;
}) {
  const tenantInfo = getTenantInfoFromRequest(request);

  await createProcessingJob({
    tenantSlug: tenantInfo.tenant_slug,
    tenantHost: tenantInfo.tenant_host,
    tramiteId,
    processingDate,
    delayMinutes,
  });
}

export async function cancelPendingProcessingJobs({
  tenantSlug,
  tramiteId,
  controlClient = getTursoControlClient(),
}: {
  tenantSlug: string;
  tramiteId?: string;
  controlClient?: Client;
}) {
  const now = new Date().toISOString();
  const filters = ["tenant_slug = ?", "status = 'pending'"];
  const args: (string | number)[] = [tenantSlug];

  if (tramiteId) {
    filters.push("tramite_id = ?");
    args.push(tramiteId);
  }

  await controlClient.execute({
    sql: `UPDATE crm_processing_jobs
      SET status = 'canceled', updated_at = ?
      WHERE ${filters.join(" AND ")}`,
    args: [now, ...args],
  });
}

export async function cancelPendingProcessingJobsFromRequest({
  request,
  tramiteId,
}: {
  request: NextRequest;
  tramiteId?: string;
}) {
  const tenantInfo = getTenantInfoFromRequest(request);

  await cancelPendingProcessingJobs({
    tenantSlug: tenantInfo.tenant_slug,
    tramiteId,
  });
}

export async function getDueProcessingJobs({
  now = new Date().toISOString(),
  limit = 50,
  controlClient = getTursoControlClient(),
}: {
  now?: string;
  limit?: number;
  controlClient?: Client;
} = {}): Promise<ProcessingJob[]> {
  const response = await controlClient.execute({
    sql: `SELECT
        id,
        tenant_slug,
        tenant_host,
        tramite_id,
        processing_date,
        due_at,
        status,
        attempts,
        last_error,
        created_at,
        updated_at
      FROM crm_processing_jobs
      WHERE status = 'pending' AND due_at <= ?
      ORDER BY due_at ASC
      LIMIT ?`,
    args: [now, limit],
  });

  return response.rows.map((row) => ({
    id: String(row.id),
    tenant_slug: String(row.tenant_slug),
    tenant_host: String(row.tenant_host),
    tramite_id: String(row.tramite_id),
    processing_date: String(row.processing_date),
    due_at: String(row.due_at),
    status: row.status as ProcessingJob["status"],
    attempts: Number(row.attempts) || 0,
    last_error: row.last_error ? String(row.last_error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function claimProcessingJob(
  controlClient: Client,
  jobId: string,
) {
  const response = await controlClient.execute({
    sql: `UPDATE crm_processing_jobs
      SET status = 'running',
          attempts = attempts + 1,
          updated_at = ?
      WHERE id = ? AND status = 'pending'`,
    args: [new Date().toISOString(), jobId],
  });

  return response.rowsAffected > 0;
}

export async function updateProcessingJobStatus({
  controlClient,
  jobId,
  status,
  lastError = null,
  retryAt = null,
}: {
  controlClient: Client;
  jobId: string;
  status: ProcessingJob["status"];
  lastError?: string | null;
  retryAt?: string | null;
}) {
  if (retryAt) {
    await controlClient.execute({
      sql: `UPDATE crm_processing_jobs
        SET status = ?,
            due_at = ?,
            last_error = ?,
            updated_at = ?
        WHERE id = ?`,
      args: [
        status,
        retryAt,
        lastError,
        new Date().toISOString(),
        jobId,
      ],
    });
    return;
  }

  await controlClient.execute({
    sql: `UPDATE crm_processing_jobs
      SET status = ?,
          last_error = ?,
          updated_at = ?
      WHERE id = ?`,
    args: [status, lastError, new Date().toISOString(), jobId],
  });
}
