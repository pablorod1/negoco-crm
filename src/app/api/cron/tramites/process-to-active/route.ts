import { NextRequest, NextResponse } from "next/server";
import type { Client } from "@libsql/client";
import {
  getTursoClientByTenant,
  getTursoControlClient,
} from "@/core/libsql/client";
import { ServerNotificationsService } from "@/core/services/serverNotificationsService";
import {
  claimProcessingJob,
  getDueProcessingJobs,
  updateProcessingJobStatus,
} from "@/crm-settings/processing-jobs";
import type { ProcessingJob } from "@/crm-settings/types";
import {
  addMinutes,
  addOneYear,
  getOriginFromHost,
} from "@/crm-settings/utils";
import { sendTramiteStatusUpdatedNotificationForHost } from "@/tramites/server/tramite-status-email";

const MAX_ATTEMPTS = 3;
const JOB_LIMIT = 50;

type ProcessResult =
  | "completed"
  | "skipped"
  | "retry_scheduled"
  | "failed"
  | "already_claimed";

interface TramiteProcessingRow {
  id: string;
  status: string;
  processing_date: string | null;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  org_logo: string | null;
  client_name: string | null;
  client_last_name: string | null;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

const truncateError = (message: string) => message.slice(0, 1000);

async function getTramiteForJob(
  tenantClient: Client,
  tramiteId: string,
): Promise<TramiteProcessingRow | null> {
  const response = await tenantClient.execute({
    sql: `SELECT
        t.id,
        t.status,
        t.processing_date,
        t.user_id,
        u.email AS user_email,
        u.name AS user_name,
        o.logo AS org_logo,
        c.name AS client_name,
        c.last_name AS client_last_name
      FROM tramites t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN user u ON t.user_id = u.id
      LEFT JOIN member m ON u.id = m.user_id
      LEFT JOIN organization o ON m.organization_id = o.id
      WHERE t.id = ?
      LIMIT 1`,
    args: [tramiteId],
  });

  const row = response.rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    status: String(row.status),
    processing_date: row.processing_date ? String(row.processing_date) : null,
    user_id: row.user_id ? String(row.user_id) : null,
    user_email: row.user_email ? String(row.user_email) : null,
    user_name: row.user_name ? String(row.user_name) : null,
    org_logo: row.org_logo ? String(row.org_logo) : null,
    client_name: row.client_name ? String(row.client_name) : null,
    client_last_name: row.client_last_name
      ? String(row.client_last_name)
      : null,
  };
}

async function markJobSkipped(controlClient: Client, jobId: string) {
  await updateProcessingJobStatus({
    controlClient,
    jobId,
    status: "skipped",
  });
}

async function recordAutomaticActivation(
  tenantClient: Client,
  job: ProcessingJob,
) {
  await tenantClient.execute({
    sql: `INSERT INTO tramite_changes (
        id,
        tramite_id,
        user_id,
        change_type,
        field_name,
        old_value,
        new_value,
        description,
        created_at
      ) VALUES (?, ?, NULL, 'status_change', 'status', 'Procesando', 'Activo', ?, ?)`,
    args: [
      crypto.randomUUID(),
      job.tramite_id,
      "Estado cambiado automáticamente de Procesando a Activo por configuración CRM",
      new Date().toISOString(),
    ],
  });
}

async function createAutomaticNotification(
  tenantClient: Client,
  job: ProcessingJob,
  tramite: TramiteProcessingRow,
) {
  if (!tramite.user_id) return null;

  return ServerNotificationsService.create(
    {
      id: `AUTO-${job.id}`,
      title: `Trámite ${job.tramite_id} actualizado`,
      message:
        "El trámite ha pasado automáticamente de Procesando a Activo por configuración CRM.",
      user_id: tramite.user_id,
      context: "Tramites",
      priority: 3,
      link: `/tramites/${job.tramite_id}`,
      client: [tramite.client_name, tramite.client_last_name]
        .filter(Boolean)
        .join(" "),
      created_at: new Date().toISOString(),
    },
    tenantClient,
  );
}

async function sendAutomaticEmail(
  job: ProcessingJob,
  tramite: TramiteProcessingRow,
) {
  if (!tramite.user_email) return;

  await sendTramiteStatusUpdatedNotificationForHost({
    user_to: {
      name: tramite.user_name || "Usuario",
      email: tramite.user_email,
      org_logo: tramite.org_logo || undefined,
    },
    tramite_id: job.tramite_id,
    status: { old: "Procesando", new: "Activo" },
    link: getOriginFromHost(job.tenant_host),
    host: job.tenant_host,
    client: {
      name: tramite.client_name || "Cliente",
      last_name: tramite.client_last_name || undefined,
    },
  });
}

async function processJob(
  controlClient: Client,
  job: ProcessingJob,
): Promise<ProcessResult> {
  const claimed = await claimProcessingJob(controlClient, job.id);
  if (!claimed) return "already_claimed";

  try {
    const tenantClient = getTursoClientByTenant(job.tenant_slug);
    const tramite = await getTramiteForJob(tenantClient, job.tramite_id);

    if (
      !tramite ||
      tramite.status !== "Procesando" ||
      tramite.processing_date !== job.processing_date
    ) {
      await markJobSkipped(controlClient, job.id);
      return "skipped";
    }

    const activationDate = new Date();
    const renovationDate = addOneYear(activationDate);
    const updateResponse = await tenantClient.execute({
      sql: `UPDATE tramites
        SET status = 'Activo',
            liquidez_status = 'Pendiente de Cobro',
            activation_date = ?,
            renovation_date = ?,
            comision = ABS(comision),
            comision_sales_person = ABS(comision_sales_person),
            updated_at = ?
        WHERE id = ? AND status = 'Procesando' AND processing_date = ?`,
      args: [
        activationDate.toISOString(),
        renovationDate.toISOString(),
        activationDate.toISOString(),
        job.tramite_id,
        job.processing_date,
      ],
    });

    if (updateResponse.rowsAffected === 0) {
      await markJobSkipped(controlClient, job.id);
      return "skipped";
    }

    await recordAutomaticActivation(tenantClient, job);

    const sideEffectErrors: string[] = [];
    try {
      const notificationResult = await createAutomaticNotification(
        tenantClient,
        job,
        tramite,
      );
      if (notificationResult && !notificationResult.success) {
        sideEffectErrors.push(
          notificationResult.error || "No se pudo crear la notificación",
        );
      }
    } catch (error) {
      sideEffectErrors.push(errorMessage(error));
    }

    try {
      await sendAutomaticEmail(job, tramite);
    } catch (error) {
      sideEffectErrors.push(errorMessage(error));
    }

    await updateProcessingJobStatus({
      controlClient,
      jobId: job.id,
      status: "completed",
      lastError:
        sideEffectErrors.length > 0
          ? truncateError(sideEffectErrors.join(" | "))
          : null,
    });

    return "completed";
  } catch (error) {
    const attemptsAfterClaim = job.attempts + 1;
    const message = truncateError(errorMessage(error));

    if (attemptsAfterClaim >= MAX_ATTEMPTS) {
      await updateProcessingJobStatus({
        controlClient,
        jobId: job.id,
        status: "failed",
        lastError: message,
      });
      return "failed";
    }

    await updateProcessingJobStatus({
      controlClient,
      jobId: job.id,
      status: "pending",
      retryAt: addMinutes(new Date(), 5).toISOString(),
      lastError: message,
    });

    return "retry_scheduled";
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const controlClient = getTursoControlClient();
    const jobs = await getDueProcessingJobs({
      controlClient,
      limit: JOB_LIMIT,
    });

    const summary: Record<ProcessResult, number> = {
      completed: 0,
      skipped: 0,
      retry_scheduled: 0,
      failed: 0,
      already_claimed: 0,
    };

    for (const job of jobs) {
      const result = await processJob(controlClient, job);
      summary[result] += 1;
    }

    return NextResponse.json({
      success: true,
      checked: jobs.length,
      ...summary,
    });
  } catch (error) {
    console.error("Error processing CRM activation jobs:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
