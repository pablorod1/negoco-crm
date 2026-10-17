import type { Client } from "@libsql/client";
import { after } from "next/server";
import { z } from "zod";
import { getTursoControlClient } from "@/core/libsql/client";
import { notifyPricesUpdated } from "@/comparador/rates/notify-prices-updated";
import { getComercializadora, getIngest, type IngestRecord } from "@/comparador/rates/repository";
import {
  approveIngest,
  autoApproveIngest,
  buildReview,
  dayInSpain,
  processIngest,
  RateIngestError,
  rejectIngest,
  todayInSpain,
} from "@/comparador/rates/service";
import { ingestFileUrl } from "@/comparador/rates/storage";
import { summarizeIngest } from "@/comparador/rates/views";

/**
 * Las acciones de la revisión de un anexo. Las usan las rutas del CRM y la API
 * interna del backoffice de Negoco (api/internal/comparador), para que la
 * lógica de aprobar viva en un solo sitio.
 */

type TenantClient = Pick<Client, "execute" | "batch">;

const manualPower = z
  .record(z.string(), z.object({ p1: z.number().positive().max(500), p2: z.number().nonnegative().max(500) }))
  .default({});

export const DecisionsSchema = z.object({
  excludedRowKeys: z.array(z.string()).default([]),
  regulatedPowerRowKeys: z.array(z.string()).default([]),
  manualPower,
  partialUpdate: z.boolean().optional(),
  levelMap: z.record(z.string(), z.string().nullable()).optional(),
  includeCommissions: z.boolean().optional(),
  feeOverrides: z.record(z.string(), z.boolean()).optional(),
  extraCommissions: z
    .array(
      z.object({
        product: z.string().trim().min(1).max(120).nullable(),
        energy: z.enum(["electricity", "gas"]),
        accessTariff: z.string().max(10).nullable(),
        level: z.string().max(60).nullable(),
        ruleType: z.enum(["fixed", "per_mwh", "fee_share"]),
        amount: z.number().positive().max(100_000),
        minAnnualKwh: z.number().nonnegative().nullable().optional(),
        maxAnnualKwh: z.number().positive().nullable().optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const ApprovalSchema = DecisionsSchema.extend({
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  includeCommissions: z.boolean().default(true),
  notes: z.string().max(1000).nullable().optional(),
});

async function requireIngest(client: TenantClient, id: string): Promise<IngestRecord> {
  const ingest = await getIngest(client, id);
  if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);
  return ingest;
}

/** Una ingesta con su revisión frente a la versión activa de hoy. */
export async function getIngestDetail(client: TenantClient, id: string) {
  const ingest = await requireIngest(client, id);
  const built = await buildReview({ client, control: getTursoControlClient(), ingest, today: todayInSpain() });
  return {
    ingest: summarizeIngest(ingest),
    originalUrl: ingest.files[0] ? await ingestFileUrl(ingest.files[0]) : null,
    bodyText: ingest.files[0] ? null : ingest.bodyText,
    issues: ingest.validation,
    review: built?.review ?? null,
  };
}

/** Revisión recalculada con las filas que el revisor excluye o completa. */
export async function previewIngest(client: TenantClient, id: string, decisions: z.infer<typeof DecisionsSchema>) {
  const ingest = await requireIngest(client, id);
  const built = await buildReview({ client, control: getTursoControlClient(), ingest, today: todayInSpain(), decisions });
  return { review: built?.review ?? null };
}

/**
 * Aprueba una ingesta y, si era lo último que faltaba del anexo, avisa a quien
 * lo envió (después de responder).
 */
export async function approveIngestById({
  client,
  id,
  input,
  userId,
  tenantSlug,
  request,
}: {
  client: TenantClient;
  id: string;
  input: z.infer<typeof ApprovalSchema>;
  userId: string;
  tenantSlug: string;
  request: Request;
}) {
  const ingest = await requireIngest(client, id);
  const result = await approveIngest({
    client,
    control: getTursoControlClient(),
    ingest,
    input,
    user: { id: userId },
    today: todayInSpain(),
  });
  const approved = await getIngest(client, id);
  if (approved) after(() => notifyPricesUpdated({ client, ingest: approved, tenantSlug, request }));
  return result;
}

/** Descarta una ingesta; si era lo que se apartó de un anexo, lo da por terminado. */
export async function rejectIngestById({
  client,
  id,
  userId,
  tenantSlug,
  request,
}: {
  client: TenantClient;
  id: string;
  userId: string;
  tenantSlug: string;
  request: Request;
}) {
  const ingest = await requireIngest(client, id);
  await rejectIngest({ client, ingest, user: { id: userId } });
  after(() => notifyPricesUpdated({ client, ingest, tenantSlug, request }));
  return { id };
}

/** Asigna la comercializadora a una ingesta que llegó sin ella. Después hay que leerla otra vez. */
export async function assignIngestSupplier(client: TenantClient, id: string, comercializadoraId: string) {
  const ingest = await requireIngest(client, id);
  if (["approved", "rejected", "processing"].includes(ingest.status)) {
    throw new RateIngestError("Esta ingesta ya está decidida o se está procesando.", 409);
  }
  if (!(await getComercializadora(client, comercializadoraId))) {
    throw new RateIngestError("Comercializadora no encontrada", 404);
  }
  await client.execute({
    sql: "UPDATE rate_ingests SET comercializadora_id = ? WHERE id = ?",
    args: [comercializadoraId, id],
  });
  return { id };
}

/**
 * Lee (o vuelve a leer) una ingesta y, si sale limpia o con dudas que se
 * resuelven solas, la aprueba como el buzón: lo que envía el tenant no tiene
 * que revisarlo nadie.
 */
export async function processIngestById({
  client,
  id,
  userId,
  tenantSlug,
  request,
}: {
  client: TenantClient;
  id: string;
  userId: string;
  tenantSlug: string;
  request: Request;
}) {
  const ingest = await requireIngest(client, id);
  const status = await processIngest({ client, ingest, tenantSlug, userId });
  if (status !== "ready" && status !== "needs_review") return { id, status };

  const result = await autoApproveIngest({
    client,
    control: getTursoControlClient(),
    ingest: (await getIngest(client, id))!,
    approvedBy: userId,
    // Sin fecha en el documento, la del día en que llegó (en España).
    receivedOn: dayInSpain(ingest.receivedAt),
    today: todayInSpain(),
  });
  if (result.approved && !result.pendingIngestId) {
    const approved = await getIngest(client, id);
    if (approved) after(() => notifyPricesUpdated({ client, ingest: approved, tenantSlug, request }));
  }
  return { id, status: result.approved ? ("approved" as const) : status };
}

/** Comercializadoras activas del tenant, para asignar la de un anexo que llegó sin ella. */
export async function listActiveSuppliers(client: TenantClient) {
  const { rows } = await client.execute("SELECT id, name FROM comercializadoras WHERE active = 1 ORDER BY name");
  return rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}
