import { createHash } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import { NextResponse } from "next/server";
import {
  AbarcaWebhookSchema,
  type AbarcaWebhookPayload,
} from "@/comparativas/types/abarca.types";
import {
  attachApoloSipsToRawPayload,
  createAbarcaApoloSipsSummary,
} from "@/comparativas/utils/abarca-apolo-sips";
import { deleteFiles } from "@/core/firebase/data/deleteFile";
import { uploadBase64File } from "@/core/firebase/data/uploadBase64File";
import { getTursoClientByTenant } from "@/core/libsql/client";
import {
  getApoloSipsBaseCups,
  isValidApoloSipsCups,
  sanitizeCups,
} from "@/integrations/apolo-sips/cups";
import { fetchApoloSipsProcedure } from "@/integrations/apolo-sips/server";
import type { ApoloSipsElectricityConsumptionRow } from "@/integrations/apolo-sips/types";

const CLAIM_LEASE_SECONDS = 5 * 60;
const CLAIM_HEARTBEAT_MS = 30 * 1000;
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const SIPS_TIMEOUT_MS = 15 * 1000;
const SAFE_RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_WEBHOOK_BODY_BYTES = 17 * 1024 * 1024;

type QueryClient = Pick<Client, "execute">;
type WriteTransaction = Pick<
  Transaction,
  "execute" | "commit" | "rollback"
>;

type ClaimResult =
  | { kind: "acquired"; token: string }
  | { kind: "cleanup_required"; token: string; storagePaths: string[] }
  | { kind: "completed" }
  | { kind: "busy" }
  | { kind: "not_found" }
  | { kind: "not_pending" };

type ClaimCompletion =
  | { kind: "completed"; token: string | null }
  | { kind: "not_completed" }
  | { kind: "unknown" };

interface PlannedUpload {
  base64: string;
  contentType: "application/pdf" | "image/jpeg";
  extension: "pdf" | "jpg";
  filename: string;
  storagePath: string;
}

interface UploadedFile extends PlannedUpload {
  downloadURL: string;
  size: number;
}

interface LeaseGuard {
  cancelNetwork: () => void;
  renew: () => Promise<boolean>;
  signal: AbortSignal;
  stop: () => Promise<void>;
}

class WebhookRaceError extends Error {
  constructor() {
    super("Webhook claim or comparison status changed");
    this.name = "WebhookRaceError";
  }
}

class OversizedWebhookBodyError extends Error {}

class WebhookLeaseLostError extends Error {
  constructor() {
    super("Webhook lease ownership lost");
    this.name = "WebhookLeaseLostError";
  }
}

function jsonError(
  error: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503,
) {
  return NextResponse.json({ success: false, error }, { status });
}

async function readBoundedJson(req: Request): Promise<unknown> {
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_WEBHOOK_BODY_BYTES
    ) {
      throw new OversizedWebhookBodyError();
    }
  }

  if (!req.body) {
    throw new Error("Webhook body is missing");
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      throw new OversizedWebhookBodyError();
    }
    chunks.push(value);
  }

  const rawBody = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes,
  ).toString("utf8");
  return JSON.parse(rawBody) as unknown;
}

function createLeaseGuard(
  db: QueryClient,
  comparativaId: string,
  claimToken: string,
): LeaseGuard {
  const controller = new AbortController();
  let stopped = false;
  let lost = false;
  let renewalQueue = Promise.resolve(true);

  const loseOwnership = (error?: unknown) => {
    if (error) {
      console.error("[abarca-webhook] lease renewal failed", error);
    }
    lost = true;
    controller.abort();
  };

  const renew = () => {
    renewalQueue = renewalQueue.then(async () => {
      if (stopped || lost) return !lost;

      const now = new Date().toISOString();
      try {
        const result = await db.execute({
          sql: `UPDATE abarca_webhook_deliveries
            SET
              claimed_at = ?,
              lease_expires_at = unixepoch() + ?,
              updated_at = ?
            WHERE comparativa_id = ?
              AND status = 'processing'
              AND claim_token = ?
              AND lease_expires_at > unixepoch()`,
          args: [
            now,
            CLAIM_LEASE_SECONDS,
            now,
            comparativaId,
            claimToken,
          ],
        });
        if (result.rowsAffected !== 1) {
          loseOwnership();
          return false;
        }
        return true;
      } catch (error) {
        loseOwnership(error);
        return false;
      }
    });
    return renewalQueue;
  };

  const timer = setInterval(() => {
    void renew();
  }, CLAIM_HEARTBEAT_MS);

  return {
    cancelNetwork: () => controller.abort(),
    renew,
    signal: controller.signal,
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await renewalQueue;
    },
  };
}

function parseStoragePaths(value: unknown): string[] {
  if (typeof value !== "string") {
    throw new Error("Webhook cleanup paths are invalid");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Webhook cleanup paths are invalid");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length > 4 ||
    parsed.some((path) => typeof path !== "string" || path.length === 0)
  ) {
    throw new Error("Webhook cleanup paths are invalid");
  }
  return parsed;
}

function hasExpectedCleanupPrefix(
  storagePaths: readonly string[],
  organizationId: string,
  comparativaId: string,
  claimToken: string,
): boolean {
  const prefix = `${organizationId}/comparativas/${comparativaId}/abarca/${claimToken}/`;
  return storagePaths.every(
    (path) => path.startsWith(prefix) && !path.includes("/../"),
  );
}

async function acquireClaim(
  db: Client,
  comparativaId: string,
  payloadHash: string,
  proposedToken: string,
  storagePaths: readonly string[],
): Promise<ClaimResult> {
  const transaction: WriteTransaction = await db.transaction("write");

  try {
    const pendingCleanup = await transaction.execute({
      sql: `SELECT claim_token, storage_paths
        FROM abarca_webhook_cleanup_queue
        WHERE comparativa_id = ? AND status = 'pending'
        ORDER BY created_at
        LIMIT 1`,
      args: [comparativaId],
    });
    if (pendingCleanup.rows.length > 0) {
      const pendingStoragePaths = parseStoragePaths(
        pendingCleanup.rows[0].storage_paths,
      );
      await transaction.rollback();
      return {
        kind: "cleanup_required",
        token: String(pendingCleanup.rows[0].claim_token),
        storagePaths: pendingStoragePaths,
      };
    }

    const existingClaim = await transaction.execute({
      sql: `SELECT
          status,
          claim_token,
          claimed_at,
          lease_expires_at,
          lease_expires_at <= unixepoch() AS lease_expired
        FROM abarca_webhook_deliveries
        WHERE comparativa_id = ?`,
      args: [comparativaId],
    });
    const claim = existingClaim.rows[0];
    if (String(claim?.status ?? "") === "completed") {
      await transaction.rollback();
      return { kind: "completed" };
    }

    const comparison = await transaction.execute({
      sql: "SELECT status FROM comparativas WHERE id = ?",
      args: [comparativaId],
    });
    if (comparison.rows.length === 0) {
      await transaction.rollback();
      return { kind: "not_found" };
    }
    if (String(comparison.rows[0].status) !== "pending") {
      await transaction.rollback();
      return { kind: "not_pending" };
    }

    const now = new Date().toISOString();
    const claimStatus = String(claim?.status ?? "");
    const claimToken =
      claim?.claim_token === null || claim?.claim_token === undefined
        ? null
        : String(claim.claim_token);
    if (
      claimStatus === "processing" &&
      claim?.lease_expires_at === undefined
    ) {
      throw new Error("Webhook lease state is missing");
    }
    const claimLeaseExpired =
      claimStatus === "processing" &&
      Number(claim?.lease_expired) === 1;
    const claimNeedsRelease =
      claimStatus === "failed" || claimLeaseExpired;

    if (claimNeedsRelease && claimToken) {
      const activeCleanup = await transaction.execute({
        sql: `SELECT storage_paths
          FROM abarca_webhook_cleanup_queue
          WHERE comparativa_id = ?
            AND claim_token = ?
            AND status = 'active'`,
        args: [comparativaId, claimToken],
      });
      if (activeCleanup.rows.length > 0) {
        const activeStoragePaths = parseStoragePaths(
          activeCleanup.rows[0].storage_paths,
        );
        const cleanupUpdate = await transaction.execute({
          sql: `UPDATE abarca_webhook_cleanup_queue
            SET status = 'pending', updated_at = ?
            WHERE comparativa_id = ?
              AND claim_token = ?
              AND status = 'active'`,
          args: [now, comparativaId, claimToken],
        });
        if (cleanupUpdate.rowsAffected === 0) {
          await transaction.rollback();
          return { kind: "busy" };
        }
        await transaction.commit();
        return {
          kind: "cleanup_required",
          token: claimToken,
          storagePaths: activeStoragePaths,
        };
      }
      throw new Error("Webhook cleanup state is missing");
    }

    if (!claim) {
      const inserted = await transaction.execute({
        sql: `INSERT INTO abarca_webhook_deliveries (
            comparativa_id,
            payload_hash,
            status,
            claim_token,
            attempt_count,
            claimed_at,
            lease_expires_at,
            created_at,
            updated_at
          ) VALUES (
            ?, ?, 'processing', ?, 1, ?,
            unixepoch() + ?, ?, ?
          )
          ON CONFLICT(comparativa_id) DO NOTHING`,
        args: [
          comparativaId,
          payloadHash,
          proposedToken,
          now,
          CLAIM_LEASE_SECONDS,
          now,
          now,
        ],
      });
      if (inserted.rowsAffected === 0) {
        const concurrentClaim = await transaction.execute({
          sql: `SELECT status
            FROM abarca_webhook_deliveries
            WHERE comparativa_id = ?`,
          args: [comparativaId],
        });
        await transaction.rollback();
        return String(concurrentClaim.rows[0]?.status) === "completed"
          ? { kind: "completed" }
          : { kind: "busy" };
      }
    } else {
      const reclaimed = await transaction.execute({
        sql: `UPDATE abarca_webhook_deliveries
          SET
            payload_hash = ?,
            status = 'processing',
            claim_token = ?,
            attempt_count = attempt_count + 1,
            claimed_at = ?,
            lease_expires_at = unixepoch() + ?,
            completed_at = NULL,
            updated_at = ?
          WHERE comparativa_id = ?
            AND (
              status = 'failed'
              OR (
                status = 'processing'
                AND lease_expires_at <= unixepoch()
              )
            )`,
        args: [
          payloadHash,
          proposedToken,
          now,
          CLAIM_LEASE_SECONDS,
          now,
          comparativaId,
        ],
      });
      if (reclaimed.rowsAffected === 0) {
        await transaction.rollback();
        return { kind: "busy" };
      }
    }

    await transaction.execute({
      sql: `INSERT INTO abarca_webhook_cleanup_queue (
          comparativa_id,
          claim_token,
          storage_paths,
          status,
          attempt_count,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, 'active', 0, ?, ?)`,
      args: [
        comparativaId,
        proposedToken,
        JSON.stringify(storagePaths),
        now,
        now,
      ],
    });

    await transaction.commit();
    return { kind: "acquired", token: proposedToken };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function sanitizeFileSegment(value: string | null | undefined): string {
  const sanitized = (value ?? "comparativa")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return sanitized || "comparativa";
}

function planUploads(
  payload: AbarcaWebhookPayload,
  organizationId: string,
  comparativaId: string,
  claimToken: string,
): PlannedUpload[] {
  const storagePath = `${organizationId}/comparativas/${comparativaId}/abarca/${claimToken}`;
  const uploads: PlannedUpload[] = [];

  if (payload.comparativa_pdf) {
    const filename = `estudio_${sanitizeFileSegment(payload.empresa)}.pdf`;
    uploads.push({
      base64: payload.comparativa_pdf,
      contentType: "application/pdf",
      extension: "pdf",
      filename,
      storagePath: `${storagePath}/${filename}`,
    });
  }
  if (payload.dni_photo_front) {
    uploads.push({
      base64: payload.dni_photo_front,
      contentType: "image/jpeg",
      extension: "jpg",
      filename: "dni_frontal.jpg",
      storagePath: `${storagePath}/dni_frontal.jpg`,
    });
  }
  if (payload.dni_photo_back) {
    uploads.push({
      base64: payload.dni_photo_back,
      contentType: "image/jpeg",
      extension: "jpg",
      filename: "dni_reverso.jpg",
      storagePath: `${storagePath}/dni_reverso.jpg`,
    });
  }
  if (payload.justo_titulo) {
    uploads.push({
      base64: payload.justo_titulo,
      contentType: "application/pdf",
      extension: "pdf",
      filename: "justo_titulo.pdf",
      storagePath: `${storagePath}/justo_titulo.pdf`,
    });
  }

  return uploads;
}

async function uploadPlannedFiles(
  plannedUploads: readonly PlannedUpload[],
  signal: AbortSignal,
  cancelNetwork: () => void,
): Promise<UploadedFile[]> {
  const results = await Promise.allSettled(
    plannedUploads.map(async (planned) => {
      try {
        const result = await uploadBase64File(
          planned.base64,
          planned.storagePath,
          planned.contentType,
          { signal, timeoutMs: UPLOAD_TIMEOUT_MS },
        );
        return {
          ...planned,
          downloadURL: result.downloadURL,
          size: Buffer.from(planned.base64, "base64").length,
        };
      } catch (error) {
        cancelNetwork();
        throw error;
      }
    }),
  );
  const failed = results.find(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected",
  );
  if (failed) throw failed.reason;

  return results.map(
    (result) => (result as PromiseFulfilledResult<UploadedFile>).value,
  );
}

async function cleanupExactUploads(
  storagePaths: readonly string[],
): Promise<string[]> {
  const results = await Promise.allSettled(
    storagePaths.map((path) => deleteFiles([path])),
  );

  const failedPaths: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status !== "rejected") continue;
    if (
      typeof result.reason === "object" &&
      result.reason !== null &&
      "code" in result.reason &&
      result.reason.code === "storage/object-not-found"
    ) {
      continue;
    }

    console.error("[abarca-webhook] exact upload cleanup failed", result.reason);
    failedPaths.push(storagePaths[index]);
  }
  return failedPaths;
}

async function persistCleanupOutcome(
  db: Client,
  comparativaId: string,
  claimToken: string,
  failedPaths: readonly string[],
): Promise<void> {
  const transaction: WriteTransaction = await db.transaction("write");
  const now = new Date().toISOString();

  try {
    if (failedPaths.length > 0) {
      await transaction.execute({
        sql: `INSERT INTO abarca_webhook_cleanup_queue (
            comparativa_id,
            claim_token,
            storage_paths,
            status,
            attempt_count,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, 'pending', 1, ?, ?)
          ON CONFLICT(comparativa_id, claim_token) DO UPDATE SET
            storage_paths = excluded.storage_paths,
            status = 'pending',
            attempt_count = abarca_webhook_cleanup_queue.attempt_count + 1,
            updated_at = excluded.updated_at`,
        args: [
          comparativaId,
          claimToken,
          JSON.stringify(failedPaths),
          now,
          now,
        ],
      });
    } else {
      await transaction.execute({
        sql: `DELETE FROM abarca_webhook_cleanup_queue
          WHERE comparativa_id = ? AND claim_token = ?`,
        args: [comparativaId, claimToken],
      });
    }

    await transaction.execute({
      sql: `UPDATE abarca_webhook_deliveries
        SET
          status = 'failed',
          claim_token = ?,
          updated_at = ?
        WHERE comparativa_id = ?
          AND claim_token = ?
          AND status IN ('processing', 'failed')`,
      args: [
        failedPaths.length > 0 ? claimToken : null,
        now,
        comparativaId,
        claimToken,
      ],
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getClaimCompletion(
  db: QueryClient,
  comparativaId: string,
): Promise<ClaimCompletion> {
  try {
    const result = await db.execute({
      sql: `SELECT status, claim_token
        FROM abarca_webhook_deliveries
        WHERE comparativa_id = ?`,
      args: [comparativaId],
    });
    if (String(result.rows[0]?.status ?? "") !== "completed") {
      return { kind: "not_completed" };
    }
    return {
      kind: "completed",
      token:
        result.rows[0]?.claim_token === null ||
        result.rows[0]?.claim_token === undefined
          ? null
          : String(result.rows[0].claim_token),
    };
  } catch {
    return { kind: "unknown" };
  }
}

function getEstudioArgs(
  payload: AbarcaWebhookPayload,
  rawPayload: string,
) {
  return [
    payload.crm_id,
    payload.ide,
    payload.cups ?? null,
    payload.tipo_tarifa ?? null,
    payload.potencia_contratada ?? null,
    payload.potencia_contratada_p2 ?? null,
    payload.potencia_contratada_p3 ?? null,
    payload.potencia_contratada_p4 ?? null,
    payload.potencia_contratada_p5 ?? null,
    payload.potencia_contratada_p6 ?? null,
    payload.consumo_p1 ?? null,
    payload.consumo_p2 ?? null,
    payload.consumo_p3 ?? null,
    payload.consumo_p4 ?? null,
    payload.consumo_p5 ?? null,
    payload.consumo_p6 ?? null,
    payload.empresa_cliente ?? null,
    payload.empresa ?? null,
    payload.nombre_completo ?? null,
    payload.titular ?? null,
    payload.ape1 ?? null,
    payload.ape2 ?? null,
    payload.dni ?? null,
    payload.nif_empresa ? 1 : 0,
    payload.autonomo ? 1 : 0,
    payload.calle ?? null,
    payload.numero ?? null,
    payload.codpostal ?? null,
    payload.localidad ?? null,
    payload.calle_cups ?? null,
    payload.numero_cups ?? null,
    payload.codpostal_cups ?? null,
    payload.localidad_cups ?? null,
    payload.email ?? null,
    payload.movil ?? null,
    payload.iban ?? null,
    payload.cambio_titularidad ? 1 : 0,
    payload.tiene_placas ? 1 : 0,
    payload.observaciones ?? null,
    payload.servicios ?? null,
    payload.permanencia ?? 0,
    rawPayload,
  ];
}

async function writeEstudio(
  transaction: QueryClient,
  comparativaId: string,
  payload: AbarcaWebhookPayload,
  rawPayload: string,
): Promise<void> {
  const existing = await transaction.execute({
    sql: "SELECT id FROM abarca_estudios WHERE comparativa_id = ?",
    args: [comparativaId],
  });
  const estudioArgs = getEstudioArgs(payload, rawPayload);

  if (existing.rows.length > 0) {
    await transaction.execute({
      sql: `UPDATE abarca_estudios SET
        crm_id = ?, ide = ?,
        cups = ?, tipo_tarifa = ?, potencia_contratada = ?, potencia_contratada_p2 = ?, potencia_contratada_p3 = ?, potencia_contratada_p4 = ?, potencia_contratada_p5 = ?, potencia_contratada_p6 = ?,
        consumo_p1 = ?, consumo_p2 = ?, consumo_p3 = ?, consumo_p4 = ?, consumo_p5 = ?, consumo_p6 = ?,
        empresa_cliente = ?, empresa = ?,
        nombre_completo = ?, titular = ?, ape1 = ?, ape2 = ?, dni = ?, nif_empresa = ?, autonomo = ?,
        calle = ?, numero = ?, codpostal = ?, localidad = ?,
        calle_cups = ?, numero_cups = ?, codpostal_cups = ?, localidad_cups = ?,
        email = ?, movil = ?, iban = ?,
        cambio_titularidad = ?, tiene_placas = ?,
        observaciones = ?, servicios = ?, permanencia = ?,
        raw_payload = ?
      WHERE comparativa_id = ?`,
      args: [...estudioArgs, comparativaId],
    });
    return;
  }

  await transaction.execute({
    sql: `INSERT INTO abarca_estudios (
      id, comparativa_id, crm_id, ide,
      cups, tipo_tarifa, potencia_contratada, potencia_contratada_p2, potencia_contratada_p3, potencia_contratada_p4, potencia_contratada_p5, potencia_contratada_p6,
      consumo_p1, consumo_p2, consumo_p3, consumo_p4, consumo_p5, consumo_p6,
      empresa_cliente, empresa,
      nombre_completo, titular, ape1, ape2, dni, nif_empresa, autonomo,
      calle, numero, codpostal, localidad,
      calle_cups, numero_cups, codpostal_cups, localidad_cups,
      email, movil, iban,
      cambio_titularidad, tiene_placas,
      observaciones, servicios, permanencia,
      raw_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), comparativaId, ...estudioArgs],
  });
}

async function finalizeDelivery(
  db: Client,
  comparativaId: string,
  claimToken: string,
  payload: AbarcaWebhookPayload,
  rawPayload: string,
  uploadedFiles: readonly UploadedFile[],
): Promise<void> {
  const transaction: WriteTransaction = await db.transaction("write");

  try {
    const claim = await transaction.execute({
      sql: `SELECT
          status,
          claim_token,
          lease_expires_at > unixepoch() AS lease_valid
        FROM abarca_webhook_deliveries
        WHERE comparativa_id = ?`,
      args: [comparativaId],
    });
    if (
      String(claim.rows[0]?.status ?? "") !== "processing" ||
      String(claim.rows[0]?.claim_token ?? "") !== claimToken ||
      Number(claim.rows[0]?.lease_valid) !== 1
    ) {
      throw new WebhookRaceError();
    }

    const comparison = await transaction.execute({
      sql: "SELECT status FROM comparativas WHERE id = ?",
      args: [comparativaId],
    });
    if (
      comparison.rows.length === 0 ||
      !["pending", "processing"].includes(
        String(comparison.rows[0].status),
      )
    ) {
      throw new WebhookRaceError();
    }

    const now = new Date().toISOString();
    for (const file of uploadedFiles) {
      await transaction.execute({
        sql: `INSERT INTO comparativa_files (
            id,
            comparativa_id,
            filename,
            size,
            extension,
            upload_date,
            download_url,
            preview_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          comparativaId,
          file.filename,
          file.size,
          file.extension,
          now,
          file.downloadURL,
          null,
        ],
      });
    }

    await writeEstudio(transaction, comparativaId, payload, rawPayload);

    const statusUpdate = await transaction.execute({
      sql: `UPDATE comparativas
        SET status = 'awaiting_review'
        WHERE id = ? AND status IN ('pending', 'processing')`,
      args: [comparativaId],
    });
    if (statusUpdate.rowsAffected === 0) {
      throw new WebhookRaceError();
    }

    const claimUpdate = await transaction.execute({
      sql: `UPDATE abarca_webhook_deliveries
        SET
          status = 'completed',
          completed_at = ?,
          updated_at = ?
        WHERE comparativa_id = ?
          AND status = 'processing'
          AND claim_token = ?`,
      args: [now, now, comparativaId, claimToken],
    });
    if (claimUpdate.rowsAffected === 0) {
      throw new WebhookRaceError();
    }

    const cleanupDelete = await transaction.execute({
      sql: `DELETE FROM abarca_webhook_cleanup_queue
        WHERE comparativa_id = ?
          AND claim_token = ?
          AND status = 'active'`,
      args: [comparativaId, claimToken],
    });
    if (cleanupDelete.rowsAffected === 0) {
      throw new WebhookRaceError();
    }

    await transaction.commit();
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        "[abarca-webhook] final transaction rollback failed",
        rollbackError,
      );
    }
    throw error;
  }
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.ABARCA_API_KEY) {
    return jsonError("Unauthorized", 401);
  }

  const tenant = req.headers.get("x-tenant");
  if (!tenant) {
    console.error("[abarca-webhook] missing tenant");
    return jsonError("Invalid request", 400);
  }

  const comparativaId = req.headers.get("x-comparativa-id");
  if (!comparativaId || !SAFE_RESOURCE_ID.test(comparativaId)) {
    return jsonError("Invalid request", 400);
  }

  let body: unknown;
  try {
    body = await readBoundedJson(req);
  } catch {
    return jsonError("Invalid request", 400);
  }
  const parsed = AbarcaWebhookSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[abarca-webhook] invalid payload", parsed.error.issues);
    return jsonError("Invalid request", 400);
  }
  const payload = parsed.data;

  let db: Client;
  try {
    db = getTursoClientByTenant(tenant);
  } catch (error) {
    console.error("[abarca-webhook] invalid tenant", error);
    return jsonError("Not found", 404);
  }

  let organizationId: string;
  try {
    const organization = await db.execute(
      "SELECT id, abarca_user_id FROM organization LIMIT 1",
    );
    if (organization.rows.length === 0) {
      return jsonError("Not found", 404);
    }
    if (Number(organization.rows[0].abarca_user_id) !== payload.crm_id) {
      return jsonError("Forbidden", 403);
    }
    organizationId = String(organization.rows[0].id);
  } catch (error) {
    console.error("[abarca-webhook] organization lookup failed", error);
    return jsonError("Internal server error", 500);
  }

  const payloadHash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  let claimToken: string | null = null;
  let plannedUploads: PlannedUpload[] = [];
  let retriedPendingCleanup = false;

  while (claimToken === null) {
    const proposedToken = crypto.randomUUID();
    const proposedUploads = planUploads(
      payload,
      organizationId,
      comparativaId,
      proposedToken,
    );
    let claim: ClaimResult;
    try {
      claim = await acquireClaim(
        db,
        comparativaId,
        payloadHash,
        proposedToken,
        proposedUploads.map(({ storagePath }) => storagePath),
      );
    } catch (error) {
      console.error("[abarca-webhook] claim acquisition failed", error);
      return jsonError("Internal server error", 500);
    }

    if (claim.kind === "cleanup_required") {
      if (
        retriedPendingCleanup ||
        !hasExpectedCleanupPrefix(
          claim.storagePaths,
          organizationId,
          comparativaId,
          claim.token,
        )
      ) {
        return jsonError("Processing in progress", 503);
      }

      const failedPaths = await cleanupExactUploads(claim.storagePaths);
      try {
        await persistCleanupOutcome(
          db,
          comparativaId,
          claim.token,
          failedPaths,
        );
      } catch (error) {
        console.error(
          "[abarca-webhook] cleanup state persistence failed",
          error,
        );
        return jsonError("Internal server error", 500);
      }
      if (failedPaths.length > 0) {
        return jsonError("Processing in progress", 503);
      }
      retriedPendingCleanup = true;
      continue;
    }
    if (claim.kind === "completed") {
      return NextResponse.json({ success: true });
    }
    if (claim.kind === "busy") {
      return jsonError("Processing in progress", 503);
    }
    if (claim.kind === "not_found") {
      return jsonError("Not found", 404);
    }
    if (claim.kind === "not_pending") {
      return jsonError("Conflict", 409);
    }

    claimToken = claim.token;
    plannedUploads = proposedUploads;
  }

  const storagePaths = plannedUploads.map(({ storagePath }) => storagePath);
  const leaseGuard = createLeaseGuard(db, comparativaId, claimToken);
  const apoloSipsPromise = fetchAbarcaApoloSipsSummary(
    payload.cups ?? undefined,
    leaseGuard.signal,
  );

  try {
    const uploadedFiles = await uploadPlannedFiles(
      plannedUploads,
      leaseGuard.signal,
      leaseGuard.cancelNetwork,
    );
    const apoloSips = await apoloSipsPromise;
    const rawPayload = attachApoloSipsToRawPayload(body, apoloSips);

    if (!(await leaseGuard.renew())) {
      throw new WebhookLeaseLostError();
    }
    await leaseGuard.stop();

    await finalizeDelivery(
      db,
      comparativaId,
      claimToken,
      payload,
      rawPayload,
      uploadedFiles,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    leaseGuard.cancelNetwork();
    await leaseGuard.stop();
    console.error("[abarca-webhook] finalization failed", error);
    const completion = await getClaimCompletion(db, comparativaId);
    if (
      completion.kind === "completed" &&
      completion.token === claimToken
    ) {
      return NextResponse.json({ success: true });
    }
    if (completion.kind === "unknown") {
      return jsonError("Processing in progress", 503);
    }

    const failedPaths = await cleanupExactUploads(storagePaths);
    try {
      await persistCleanupOutcome(
        db,
        comparativaId,
        claimToken,
        failedPaths,
      );
    } catch (cleanupError) {
      console.error(
        "[abarca-webhook] cleanup state persistence failed",
        cleanupError,
      );
      return jsonError("Internal server error", 500);
    }
    if (failedPaths.length > 0) {
      return jsonError("Processing in progress", 503);
    }
    if (completion.kind === "completed") {
      return NextResponse.json({ success: true });
    }
    return error instanceof WebhookRaceError
      ? jsonError("Conflict", 409)
      : error instanceof WebhookLeaseLostError
        ? jsonError("Processing in progress", 503)
        : jsonError("Internal server error", 500);
  }
}

async function fetchAbarcaApoloSipsSummary(
  cups: string | undefined,
  ownershipSignal: AbortSignal,
) {
  if (!cups) return null;

  const apiKey = process.env.APOLO_SIPS_API_KEY;
  if (!apiKey) {
    console.warn("[abarca-webhook] Missing SIPS API key");
    return null;
  }

  const sanitizedCups = sanitizeCups(cups);
  if (!isValidApoloSipsCups(sanitizedCups)) {
    console.warn("[abarca-webhook] invalid CUPS for SIPS", {
      cups: sanitizedCups,
    });
    return null;
  }

  const apoloSipsCups = getApoloSipsBaseCups(sanitizedCups);
  const controller = new AbortController();
  const abortForOwnershipLoss = () => controller.abort();
  if (ownershipSignal.aborted) {
    controller.abort();
  } else {
    ownershipSignal.addEventListener("abort", abortForOwnershipLoss, {
      once: true,
    });
  }
  const timeout = setTimeout(
    () => controller.abort(),
    SIPS_TIMEOUT_MS,
  );

  try {
    const consumptions = await fetchApoloSipsProcedure({
      apiKey,
      cups: apoloSipsCups,
      procedure: "CONSUMOS",
      signal: controller.signal,
      supplyType: "ELECTRICIDAD",
    });

    return createAbarcaApoloSipsSummary(
      apoloSipsCups,
      consumptions.rows as ApoloSipsElectricityConsumptionRow[],
    );
  } catch (error) {
    console.warn(
      "[abarca-webhook] unable to fetch SIPS demand power",
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timeout);
    ownershipSignal.removeEventListener(
      "abort",
      abortForOwnershipLoss,
    );
  }
}
