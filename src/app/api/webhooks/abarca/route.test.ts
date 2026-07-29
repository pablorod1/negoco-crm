import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  deleteFiles: vi.fn(),
  execute: vi.fn(),
  fetchApoloSipsProcedure: vi.fn(),
  getTursoClientByTenant: vi.fn(),
  rollback: vi.fn(),
  transaction: vi.fn(),
  uploadBase64File: vi.fn(),
}));

vi.mock("@/core/libsql/client", () => ({
  getTursoClientByTenant: mocks.getTursoClientByTenant,
}));
vi.mock("@/core/firebase/data/uploadBase64File", () => ({
  uploadBase64File: mocks.uploadBase64File,
}));
vi.mock("@/core/firebase/data/deleteFile", () => ({
  deleteFiles: mocks.deleteFiles,
}));
vi.mock("@/integrations/apolo-sips/server", () => ({
  fetchApoloSipsProcedure: mocks.fetchApoloSipsProcedure,
}));

const route = await import("./route");
const validPdfBase64 = Buffer.from("%PDF-1.7").toString("base64");
const validJpegBase64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9,
]).toString("base64");

interface ClaimState {
  claimedAt: string;
  leaseExpiresAt: number;
  status: "processing" | "completed" | "failed";
  token: string | null;
}

interface CleanupState {
  paths: string[];
  status: "active" | "pending";
  token: string;
}

interface DatabaseState {
  claim: ClaimState | null;
  cleanups: CleanupState[];
  comparisonStatus: string | null;
  files: number;
  study: boolean;
}

let state: DatabaseState;
let loseStatusCas: boolean;
let loseClaimToCompletedAttempt: boolean;
let failFinalDatabaseWrite: boolean;
let failCompletionReadback: boolean;
let throwAfterFinalCommit: boolean;
let deniedLeaseToken: string | null;

const db = {
  execute: mocks.execute,
  transaction: mocks.transaction,
};

function cloneState(): DatabaseState {
  return {
    ...state,
    claim: state.claim ? { ...state.claim } : null,
    cleanups: state.cleanups.map((cleanup) => ({
      ...cleanup,
      paths: [...cleanup.paths],
    })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeTransaction() {
  const local = cloneState();

  return {
    execute: vi.fn(
      async (statement: { sql: string; args: unknown[] }) => {
        const sql = statement.sql;

        if (
          sql.includes("SELECT claim_token, storage_paths") &&
          sql.includes("status = 'pending'")
        ) {
          const cleanup = local.cleanups.find(
            ({ status }) => status === "pending",
          );
          return {
            rows: cleanup
              ? [
                  {
                    claim_token: cleanup.token,
                    storage_paths: JSON.stringify(cleanup.paths),
                  },
                ]
              : [],
          };
        }
        if (
          sql.includes("SELECT storage_paths") &&
          sql.includes("status = 'active'")
        ) {
          const cleanup = local.cleanups.find(
            ({ status, token }) =>
              status === "active" && token === statement.args[1],
          );
          return {
            rows: cleanup
              ? [{ storage_paths: JSON.stringify(cleanup.paths) }]
              : [],
          };
        }
        if (
          sql.includes("claimed_at") &&
          sql.includes("AS lease_expired")
        ) {
          return {
            rows: local.claim
              ? [
                  {
                    status: local.claim.status,
                    claim_token: local.claim.token,
                    claimed_at: local.claim.claimedAt,
                    lease_expires_at: local.claim.leaseExpiresAt,
                    lease_expired: Number(
                      local.claim.leaseExpiresAt <=
                        Math.floor(Date.now() / 1000),
                    ),
                  },
                ]
              : [],
          };
        }
        if (sql.includes("AS lease_valid")) {
          if (loseClaimToCompletedAttempt) {
            state.claim = {
              status: "completed",
              token: "winning-token",
              claimedAt: new Date().toISOString(),
              leaseExpiresAt: Math.floor(Date.now() / 1000) + 5 * 60,
            };
            return {
              rows: [
                {
                  status: "completed",
                  claim_token: "winning-token",
                  lease_valid: 1,
                },
              ],
            };
          }
          return {
            rows: local.claim
              ? [
                  {
                    status: local.claim.status,
                    claim_token: local.claim.token,
                    lease_valid: Number(
                      local.claim.leaseExpiresAt >
                        Math.floor(Date.now() / 1000),
                    ),
                  },
                ]
              : [],
          };
        }
        if (sql.includes("SELECT status FROM comparativas")) {
          return {
            rows:
              local.comparisonStatus === null
                ? []
                : [{ status: local.comparisonStatus }],
          };
        }
        if (sql.includes("INSERT INTO abarca_webhook_deliveries")) {
          if (local.claim) return { rows: [], rowsAffected: 0 };
          local.claim = {
            status: "processing",
            token: String(statement.args[2]),
            claimedAt: String(statement.args[3]),
            leaseExpiresAt:
              Math.floor(Date.now() / 1000) + Number(statement.args[4]),
          };
          return { rows: [], rowsAffected: 1 };
        }
        if (
          sql.includes("UPDATE abarca_webhook_deliveries") &&
          sql.includes("attempt_count = attempt_count + 1")
        ) {
          if (
            !local.claim ||
            (local.claim.status !== "failed" &&
              local.claim.status !== "processing")
          ) {
            return { rows: [], rowsAffected: 0 };
          }
          if (
            local.claim.status === "processing" &&
            local.claim.leaseExpiresAt > Math.floor(Date.now() / 1000)
          ) {
            return { rows: [], rowsAffected: 0 };
          }
          local.claim = {
            status: "processing",
            token: String(statement.args[1]),
            claimedAt: String(statement.args[2]),
            leaseExpiresAt:
              Math.floor(Date.now() / 1000) + Number(statement.args[3]),
          };
          return { rows: [], rowsAffected: 1 };
        }
        if (
          sql.includes("UPDATE abarca_webhook_cleanup_queue") &&
          sql.includes("status = 'pending'")
        ) {
          const cleanup = local.cleanups.find(
            ({ status, token }) =>
              status === "active" && token === statement.args[2],
          );
          if (!cleanup) return { rows: [], rowsAffected: 0 };
          cleanup.status = "pending";
          return { rows: [], rowsAffected: 1 };
        }
        if (sql.includes("INSERT INTO abarca_webhook_cleanup_queue")) {
          const token = String(statement.args[1]);
          const paths = JSON.parse(String(statement.args[2])) as string[];
          const existing = local.cleanups.find(
            (cleanup) => cleanup.token === token,
          );
          if (existing) {
            existing.paths = paths;
            existing.status = sql.includes("'pending'")
              ? "pending"
              : "active";
          } else {
            local.cleanups.push({
              paths,
              status: sql.includes("'pending'") ? "pending" : "active",
              token,
            });
          }
          return { rows: [], rowsAffected: 1 };
        }
        if (sql.includes("DELETE FROM abarca_webhook_cleanup_queue")) {
          const index = local.cleanups.findIndex(
            ({ status, token }) =>
              token === statement.args[1] &&
              (!sql.includes("status = 'active'") || status === "active"),
          );
          if (index === -1) return { rows: [], rowsAffected: 0 };
          local.cleanups.splice(index, 1);
          return { rows: [], rowsAffected: 1 };
        }
        if (
          sql.includes("UPDATE abarca_webhook_deliveries") &&
          sql.includes("status = 'failed'")
        ) {
          const previousToken = statement.args[3];
          if (
            local.claim &&
            local.claim.token === previousToken &&
            (local.claim.status === "processing" ||
              local.claim.status === "failed")
          ) {
            local.claim.status = "failed";
            local.claim.token =
              statement.args[0] === null
                ? null
                : String(statement.args[0]);
            return { rows: [], rowsAffected: 1 };
          }
          return { rows: [], rowsAffected: 0 };
        }
        if (sql.includes("INSERT INTO comparativa_files")) {
          local.files += 1;
          return { rows: [], rowsAffected: 1 };
        }
        if (sql.includes("SELECT id FROM abarca_estudios")) {
          return { rows: local.study ? [{ id: "study-1" }] : [] };
        }
        if (
          sql.includes("INSERT INTO abarca_estudios") ||
          sql.includes("UPDATE abarca_estudios")
        ) {
          if (failFinalDatabaseWrite) {
            throw new Error("transient database failure");
          }
          local.study = true;
          return { rows: [], rowsAffected: 1 };
        }
        if (
          sql.includes("UPDATE comparativas") &&
          sql.includes("status = 'awaiting_review'")
        ) {
          if (loseStatusCas) {
            state.comparisonStatus = "completed";
            return { rows: [], rowsAffected: 0 };
          }
          if (local.comparisonStatus !== "pending") {
            return { rows: [], rowsAffected: 0 };
          }
          local.comparisonStatus = "awaiting_review";
          return { rows: [], rowsAffected: 1 };
        }
        if (
          sql.includes("UPDATE abarca_webhook_deliveries") &&
          sql.includes("status = 'completed'")
        ) {
          if (
            !local.claim ||
            local.claim.status !== "processing" ||
            local.claim.token !== statement.args[3]
          ) {
            return { rows: [], rowsAffected: 0 };
          }
          local.claim.status = "completed";
          return { rows: [], rowsAffected: 1 };
        }

        throw new Error(`Unexpected transaction SQL: ${sql}`);
      },
    ),
    commit: vi.fn(async () => {
      state = cloneFrom(local);
      mocks.commit();
      if (throwAfterFinalCommit && state.claim?.status === "completed") {
        throw new Error("commit result unavailable");
      }
    }),
    rollback: vi.fn(async () => {
      mocks.rollback();
    }),
  };
}

function cloneFrom(source: DatabaseState): DatabaseState {
  return {
    ...source,
    claim: source.claim ? { ...source.claim } : null,
    cleanups: source.cleanups.map((cleanup) => ({
      ...cleanup,
      paths: [...cleanup.paths],
    })),
  };
}

function request(
  body: unknown = {
    ide: 100,
    crm_id: 321,
    empresa: "Acme",
    comparativa_pdf: validPdfBase64,
  },
  headers: Record<string, string> = {},
) {
  return new Request("https://crm.example.com/api/webhooks/abarca", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "webhook-key",
      "x-tenant": "tenant",
      "x-comparativa-id": "comparison-1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ABARCA_API_KEY", "webhook-key");
  vi.stubEnv("APOLO_SIPS_API_KEY", "");

  state = {
    claim: null,
    cleanups: [],
    comparisonStatus: "pending",
    files: 0,
    study: false,
  };
  loseStatusCas = false;
  loseClaimToCompletedAttempt = false;
  failFinalDatabaseWrite = false;
  failCompletionReadback = false;
  throwAfterFinalCommit = false;
  deniedLeaseToken = null;

  mocks.getTursoClientByTenant.mockReturnValue(db);
  mocks.transaction.mockImplementation(async () => makeTransaction());
  mocks.uploadBase64File.mockImplementation(
    async (_base64: string, storagePath: string) => ({
      downloadURL: `https://storage.example/${storagePath}`,
    }),
  );
  mocks.deleteFiles.mockResolvedValue([]);
  mocks.execute.mockImplementation(
    async (
      statement:
        | string
        | {
            sql: string;
            args: unknown[];
          },
    ) => {
      if (typeof statement === "string") {
        if (statement.includes("FROM organization")) {
          return {
            rows: [{ id: "organization-1", abarca_user_id: 321 }],
          };
        }
        throw new Error(`Unexpected database SQL: ${statement}`);
      }

      if (
        statement.sql.includes("UPDATE abarca_webhook_deliveries") &&
        statement.sql.includes("lease_expires_at = unixepoch() + ?") &&
        statement.sql.includes("AND lease_expires_at > unixepoch()")
      ) {
        if (
          !state.claim ||
          state.claim.status !== "processing" ||
          state.claim.token !== statement.args[4] ||
          state.claim.token === deniedLeaseToken ||
          state.claim.leaseExpiresAt <= Math.floor(Date.now() / 1000)
        ) {
          return { rows: [], rowsAffected: 0 };
        }
        state.claim.claimedAt = String(statement.args[0]);
        state.claim.leaseExpiresAt =
          Math.floor(Date.now() / 1000) + Number(statement.args[1]);
        return { rows: [], rowsAffected: 1 };
      }
      if (
        statement.sql.includes("SELECT status") &&
        statement.sql.includes("FROM abarca_webhook_deliveries")
      ) {
        if (failCompletionReadback) {
          throw new Error("readback unavailable");
        }
        return {
          rows: state.claim
            ? [
                {
                  status: state.claim.status,
                  claim_token: state.claim.token,
                },
              ]
            : [],
        };
      }
      throw new Error(`Unexpected database SQL: ${statement.sql}`);
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/webhooks/abarca", () => {
  test("processes the initial callback exactly once", async () => {
    const response = await route.POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(state.comparisonStatus).toBe("awaiting_review");
    expect(state.claim?.status).toBe("completed");
    expect(state.files).toBe(1);
    expect(state.study).toBe(true);
    expect(mocks.uploadBase64File).toHaveBeenCalledTimes(1);
    expect(mocks.deleteFiles).not.toHaveBeenCalled();
    expect(mocks.commit).toHaveBeenCalledTimes(2);
  });

  test("treats a repeated successful callback as idempotent", async () => {
    state = {
      claim: {
        status: "completed",
        token: "completed-token",
        claimedAt: new Date().toISOString(),
        leaseExpiresAt: Math.floor(Date.now() / 1000) + 5 * 60,
      },
      cleanups: [],
      comparisonStatus: "awaiting_review",
      files: 1,
      study: true,
    };

    const response = await route.POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(state.files).toBe(1);
    expect(mocks.uploadBase64File).not.toHaveBeenCalled();
    expect(mocks.deleteFiles).not.toHaveBeenCalled();
  });

  test("returns a retryable response for a concurrent active callback", async () => {
    state.claim = {
      status: "processing",
      token: "active-token",
      claimedAt: new Date().toISOString(),
      leaseExpiresAt: Math.floor(Date.now() / 1000) + 5 * 60,
    };

    const response = await route.POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      error: "Processing in progress",
    });
    expect(mocks.uploadBase64File).not.toHaveBeenCalled();
  });

  test("renews a live owner lease beyond five minutes without exposing its uploads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const firstUpload = deferred<{ downloadURL: string }>();
    mocks.uploadBase64File.mockImplementationOnce(
      async () => firstUpload.promise,
    );

    const firstResponsePromise = route.POST(request());
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.uploadBase64File).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1);
    expect(state.claim?.leaseExpiresAt).toBeDefined();
    expect((state.claim?.leaseExpiresAt ?? 0) * 1000).toBeGreaterThan(
      Date.now(),
    );

    const concurrentResponse = await route.POST(request());

    expect(concurrentResponse.status).toBe(503);
    expect(mocks.uploadBase64File).toHaveBeenCalledTimes(1);
    expect(mocks.deleteFiles).not.toHaveBeenCalled();
    expect(state.cleanups).toHaveLength(1);
    expect(state.cleanups[0].status).toBe("active");

    const firstPath = mocks.uploadBase64File.mock.calls[0][1] as string;
    firstUpload.resolve({
      downloadURL: `https://storage.example/${firstPath}`,
    });
    await vi.advanceTimersByTimeAsync(1);

    const firstResponse = await firstResponsePromise;
    expect(firstResponse.status).toBe(200);
    expect(state.claim?.status).toBe("completed");
  });

  test("a late former owner cannot overwrite the winner and cleans its late upload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const firstUpload = deferred<{ downloadURL: string }>();
    mocks.uploadBase64File.mockImplementationOnce(
      async () => firstUpload.promise,
    );

    const lateResponsePromise = route.POST(request());
    await vi.advanceTimersByTimeAsync(1);
    const formerToken = state.claim?.token ?? null;
    const formerPath = mocks.uploadBase64File.mock.calls[0][1] as string;
    deniedLeaseToken = formerToken;

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1);
    const winningResponse = await route.POST(request());

    expect(winningResponse.status).toBe(200);
    expect(state.claim).toMatchObject({
      status: "completed",
      token: expect.not.stringContaining(formerToken ?? ""),
    });
    expect(state.files).toBe(1);
    expect(mocks.deleteFiles).toHaveBeenCalledWith([formerPath]);

    firstUpload.resolve({
      downloadURL: `https://storage.example/${formerPath}`,
    });
    await vi.advanceTimersByTimeAsync(1);
    const lateResponse = await lateResponsePromise;

    expect(lateResponse.status).toBe(200);
    expect(state.files).toBe(1);
    expect(state.claim?.status).toBe("completed");
    expect(
      mocks.deleteFiles.mock.calls.filter(
        ([paths]) => (paths as string[])[0] === formerPath,
      ),
    ).toHaveLength(2);
  });

  test("does not claim or mutate a comparison that is no longer pending", async () => {
    state.comparisonStatus = "completed";

    const response = await route.POST(request());

    expect(response.status).toBe(409);
    expect(state.claim).toBeNull();
    expect(state.files).toBe(0);
    expect(state.study).toBe(false);
    expect(mocks.uploadBase64File).not.toHaveBeenCalled();
  });

  test("cleans exact uploads and rolls back when the final status CAS loses", async () => {
    loseStatusCas = true;

    const response = await route.POST(request());
    const uploadedPath = mocks.uploadBase64File.mock.calls[0][1] as string;

    expect(response.status).toBe(409);
    expect(state.comparisonStatus).toBe("completed");
    expect(state.files).toBe(0);
    expect(state.study).toBe(false);
    expect(state.claim?.status).toBe("failed");
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.deleteFiles).toHaveBeenCalledWith([uploadedPath]);
  });

  test("cleans its own uploads when another concurrent attempt completes", async () => {
    loseClaimToCompletedAttempt = true;

    const response = await route.POST(request());
    const uploadedPath = mocks.uploadBase64File.mock.calls[0][1] as string;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(state.claim).toMatchObject({
      status: "completed",
      token: "winning-token",
    });
    expect(state.files).toBe(0);
    expect(state.study).toBe(false);
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.deleteFiles).toHaveBeenCalledWith([uploadedPath]);
  });

  test("rolls back, cleans exact uploads, and leaves a recoverable claim on DB failure", async () => {
    failFinalDatabaseWrite = true;

    const response = await route.POST(request());
    const uploadedPath = mocks.uploadBase64File.mock.calls[0][1] as string;

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Internal server error",
    });
    expect(state.comparisonStatus).toBe("pending");
    expect(state.files).toBe(0);
    expect(state.study).toBe(false);
    expect(state.claim?.status).toBe("failed");
    expect(mocks.deleteFiles).toHaveBeenCalledWith([uploadedPath]);
  });

  test("does not clean uploads when commit outcome and completion readback are both unknown", async () => {
    throwAfterFinalCommit = true;
    failCompletionReadback = true;

    const response = await route.POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      error: "Processing in progress",
    });
    expect(state.claim?.status).toBe("completed");
    expect(state.files).toBe(1);
    expect(state.study).toBe(true);
    expect(state.cleanups).toEqual([]);
    expect(mocks.deleteFiles).not.toHaveBeenCalled();
  });

  test("persists failed cleanup and retries it before a new delivery attempt", async () => {
    failFinalDatabaseWrite = true;
    mocks.deleteFiles
      .mockRejectedValueOnce(
        Object.assign(new Error("storage unavailable"), {
          code: "storage/retry-limit-exceeded",
        }),
      )
      .mockResolvedValue([]);

    const failedResponse = await route.POST(request());
    const orphanedPath = mocks.uploadBase64File.mock.calls[0][1] as string;

    expect(failedResponse.status).toBe(503);
    expect(await failedResponse.json()).toEqual({
      success: false,
      error: "Processing in progress",
    });
    expect(state.claim).toMatchObject({
      status: "failed",
      token: expect.any(String),
    });
    expect(state.cleanups).toEqual([
      {
        paths: [orphanedPath],
        status: "pending",
        token: state.claim?.token,
      },
    ]);
    expect(mocks.deleteFiles).toHaveBeenNthCalledWith(1, [orphanedPath]);

    failFinalDatabaseWrite = false;
    const retryResponse = await route.POST(request());

    expect(retryResponse.status).toBe(200);
    expect(mocks.deleteFiles).toHaveBeenNthCalledWith(2, [orphanedPath]);
    expect(state.claim?.status).toBe("completed");
    expect(state.cleanups).toEqual([]);
    expect(state.comparisonStatus).toBe("awaiting_review");
  });

  test("retries a transient failure from a failed claim", async () => {
    failFinalDatabaseWrite = true;
    const failedResponse = await route.POST(request());
    expect(failedResponse.status).toBe(500);
    expect(state.claim?.status).toBe("failed");

    failFinalDatabaseWrite = false;
    const retryResponse = await route.POST(request());

    expect(retryResponse.status).toBe(200);
    expect(state.claim?.status).toBe("completed");
    expect(state.comparisonStatus).toBe("awaiting_review");
    expect(state.files).toBe(1);
    expect(state.study).toBe(true);
    expect(mocks.uploadBase64File).toHaveBeenCalledTimes(2);
  });

  test("cleans all planned exact paths after a partial upload failure", async () => {
    mocks.uploadBase64File
      .mockResolvedValueOnce({
        downloadURL: "https://storage.example/first",
      })
      .mockRejectedValueOnce(new Error("upload failed"));

    const response = await route.POST(
      request({
        ide: 100,
        crm_id: 321,
        comparativa_pdf: validPdfBase64,
        dni_photo_front: validJpegBase64,
      }),
    );
    const plannedPaths = mocks.uploadBase64File.mock.calls.map(
      ([, storagePath]) => storagePath as string,
    );

    expect(response.status).toBe(500);
    expect(mocks.deleteFiles).toHaveBeenCalledTimes(2);
    for (const storagePath of plannedPaths) {
      expect(mocks.deleteFiles).toHaveBeenCalledWith([storagePath]);
    }
    expect(state.claim?.status).toBe("failed");
    expect(state.files).toBe(0);
  });

  test("preserves existing authorization and request validation", async () => {
    const unauthorized = await route.POST(
      request(undefined, { "x-api-key": "wrong-key" }),
    );
    expect(unauthorized.status).toBe(401);
    expect(mocks.getTursoClientByTenant).not.toHaveBeenCalled();

    const invalidPayload = await route.POST(request({ crm_id: 321 }));
    expect(invalidPayload.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();

    const crmMismatch = await route.POST(
      request({ ide: 100, crm_id: 999 }),
    );
    expect(crmMismatch.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("rejects a missing tenant before database access", async () => {
    const response = await route.POST(
      request(undefined, { "x-tenant": "" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.getTursoClientByTenant).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("returns generic not found for an invalid tenant", async () => {
    mocks.getTursoClientByTenant.mockImplementation(() => {
      throw new Error("tenant configuration detail");
    });

    const response = await route.POST(request());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: "Not found",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("rejects invalid JSON before opening a claim transaction", async () => {
    const response = await route.POST(
      new Request("https://crm.example.com/api/webhooks/abarca", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "webhook-key",
          "x-tenant": "tenant",
          "x-comparativa-id": "comparison-1",
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("rejects a missing or unsafe comparison identifier", async () => {
    const missing = await route.POST(
      request(undefined, { "x-comparativa-id": "" }),
    );
    expect(missing.status).toBe(400);

    const unsafe = await route.POST(
      request(undefined, { "x-comparativa-id": "../comparison-1" }),
    );
    expect(unsafe.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("returns not found when the comparison does not exist", async () => {
    state.comparisonStatus = null;

    const response = await route.POST(request());

    expect(response.status).toBe(404);
    expect(state.claim).toBeNull();
    expect(mocks.uploadBase64File).not.toHaveBeenCalled();
  });

  test("rejects a declared oversized request before reading or opening tenant state", async () => {
    const oversizedRequest = request();
    oversizedRequest.headers.set(
      "content-length",
      String(17 * 1024 * 1024 + 1),
    );
    const response = await route.POST(oversizedRequest);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Invalid request",
    });
    expect(mocks.getTursoClientByTenant).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("cancels a chunked request when its stream exceeds the body budget", async () => {
    let pulls = 0;
    let cancelled = false;
    const chunk = new TextEncoder().encode("x".repeat(1024 * 1024));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls <= 20) {
          controller.enqueue(chunk);
        } else {
          controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = await route.POST(
      new Request("https://crm.example.com/api/webhooks/abarca", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "webhook-key",
          "x-tenant": "tenant",
          "x-comparativa-id": "comparison-1",
        },
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );

    expect(response.status).toBe(400);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(18);
    expect(mocks.getTursoClientByTenant).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
