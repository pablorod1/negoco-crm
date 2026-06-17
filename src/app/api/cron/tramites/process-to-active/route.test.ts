import { beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { ProcessingJob } from "@/crm-settings/types";

type MockStatement = { sql: string; args?: unknown[] };

const dueJob: ProcessingJob = {
  id: "job-1",
  tenant_slug: "tenant",
  tenant_host: "tenant.example.com",
  tramite_id: "TRA-1",
  processing_date: "2026-06-16T08:00:00.000Z",
  due_at: "2026-06-16T09:00:00.000Z",
  status: "pending",
  attempts: 0,
  last_error: null,
  created_at: "2026-06-16T08:00:00.000Z",
  updated_at: "2026-06-16T08:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  controlClient: {},
  tenantExecuteImpl: undefined as
    | undefined
    | ((statement: MockStatement) => Promise<unknown>),
  tenantExecute: vi.fn((statement: MockStatement) =>
    mocks.tenantExecuteImpl?.(statement),
  ),
  getTursoControlClient: vi.fn(),
  getTursoClientByTenant: vi.fn(),
  getDueProcessingJobs: vi.fn(),
  claimProcessingJob: vi.fn(),
  updateProcessingJobStatus: vi.fn(),
  createNotification: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoControlClient: mocks.getTursoControlClient,
  getTursoClientByTenant: mocks.getTursoClientByTenant,
}));
vi.mock("/src/core/libsql/client.ts", () => ({
  getTursoControlClient: mocks.getTursoControlClient,
  getTursoClientByTenant: mocks.getTursoClientByTenant,
}));
vi.mock("@/crm-settings/processing-jobs", () => ({
  getDueProcessingJobs: mocks.getDueProcessingJobs,
  claimProcessingJob: mocks.claimProcessingJob,
  updateProcessingJobStatus: mocks.updateProcessingJobStatus,
}));
vi.mock("@/core/services/serverNotificationsService", () => ({
  ServerNotificationsService: {
    create: mocks.createNotification,
  },
}));
vi.mock("@/tramites/server/tramite-status-email", () => ({
  sendTramiteStatusUpdatedNotificationForHost: mocks.sendEmail,
}));

const route = await import("./route");

const request = (secret = "secret") =>
  new Request("https://tenant.example.com/api/cron/tramites/process-to-active", {
    headers: { authorization: `Bearer ${secret}` },
  }) as unknown as NextRequest;

beforeEach(() => {
  process.env.CRON_SECRET = "secret";
  mocks.getTursoControlClient.mockReset();
  mocks.getTursoControlClient.mockReturnValue(mocks.controlClient);
  mocks.getTursoClientByTenant.mockReset();
  mocks.getTursoClientByTenant.mockReturnValue({
    execute: mocks.tenantExecute,
  });
  mocks.getDueProcessingJobs.mockReset();
  mocks.getDueProcessingJobs.mockResolvedValue([]);
  mocks.claimProcessingJob.mockReset();
  mocks.claimProcessingJob.mockResolvedValue(true);
  mocks.updateProcessingJobStatus.mockReset();
  mocks.createNotification.mockReset();
  mocks.createNotification.mockResolvedValue({ success: true });
  mocks.sendEmail.mockReset();
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.tenantExecute.mockClear();
  mocks.tenantExecuteImpl = async (statement) => {
    if (statement.sql.includes("FROM tramites")) {
      return {
        rows: [
          {
            id: "TRA-1",
            status: "Procesando",
            processing_date: dueJob.processing_date,
            user_id: "user-1",
            user_email: "user@example.com",
            user_name: "User",
            org_logo: null,
            client_name: "Cliente",
            client_last_name: "Demo",
          },
        ],
      };
    }

    return { rows: [], rowsAffected: 1 };
  };
});

describe("GET /api/cron/tramites/process-to-active", () => {
  test("rejects invalid cron secret", async () => {
    const res = await route.GET(request("bad"));

    expect(res.status).toBe(401);
    expect(mocks.getDueProcessingJobs).not.toHaveBeenCalled();
  });

  test("returns quickly when the central queue is empty", async () => {
    const res = await route.GET(request());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checked).toBe(0);
    expect(body.completed).toBe(0);
  });

  test("processes a due processing job and marks it completed", async () => {
    mocks.getDueProcessingJobs.mockResolvedValue([dueJob]);

    const res = await route.GET(request());

    expect(res.status).toBe(200);
    expect(mocks.claimProcessingJob).toHaveBeenCalledWith(
      mocks.controlClient,
      "job-1",
    );
    expect(mocks.tenantExecute.mock.calls[1][0].sql).toContain(
      "SET status = 'Activo'",
    );
    expect(mocks.updateProcessingJobStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        controlClient: mocks.controlClient,
        jobId: "job-1",
        status: "completed",
      }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  test("skips stale jobs when status or processing_date no longer matches", async () => {
    mocks.getDueProcessingJobs.mockResolvedValue([dueJob]);
    mocks.tenantExecuteImpl = async (statement) => {
      if (statement.sql.includes("FROM tramites")) {
        return {
          rows: [
            {
              id: "TRA-1",
              status: "Activo",
              processing_date: dueJob.processing_date,
            },
          ],
        };
      }

      return { rows: [], rowsAffected: 1 };
    };

    const res = await route.GET(request());

    expect(res.status).toBe(200);
    expect(mocks.updateProcessingJobStatus).toHaveBeenCalledWith({
      controlClient: mocks.controlClient,
      jobId: "job-1",
      status: "skipped",
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
