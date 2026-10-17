import { createHmac, timingSafeEqual } from "node:crypto";
import { getTursoClientByTenant, getTursoControlClient } from "@/core/libsql/client";
import { notifyPricesUpdated } from "@/comparador/rates/notify-prices-updated";
import { getIngest } from "@/comparador/rates/repository";
import { autoApproveIngest, processIngest, todayInSpain } from "@/comparador/rates/service";

/**
 * Anexos de un correo del buzón pendientes de leer y aprobar. Se leen de uno
 * en uno y cada uno en su propia llamada: todos en la del webhook pasaban de
 * sus 300 s con un correo de 9 adjuntos y los últimos no se leían nunca.
 */
export interface InboundQueue {
  tenantSlug: string;
  ids: string[];
  /** Usuario del tenant (o `email:<remitente>`) que firma lo que se aprueba solo. */
  approvedBy: string;
  /** Día en que llegó el correo, para los anexos sin fecha. */
  receivedOn: string;
}

/** Ruta que sigue con la cola: la llama el propio servidor. */
export const INBOUND_QUEUE_PATH = "/api/webhooks/resend-tarifas/queue";
export const INBOUND_QUEUE_SIGNATURE_HEADER = "x-negoco-signature";

export function signInboundQueue(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyInboundQueue(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signInboundQueue(body, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Lee y aprueba el primer anexo de la cola y pasa el resto a otra llamada. */
export async function runInboundQueue(queue: InboundQueue, continueUrl: string, secret: string, request: Request) {
  const [id, ...rest] = queue.ids;
  const { tenantSlug } = queue;
  if (id) {
    try {
      const client = getTursoClientByTenant(tenantSlug);
      const ingest = await getIngest(client, id);
      if (ingest) {
        await processIngest({ client, ingest, tenantSlug, userId: null });
        const read = await getIngest(client, id);
        if (read) {
          const result = await autoApproveIngest({
            client,
            control: getTursoControlClient(),
            ingest: read,
            approvedBy: queue.approvedBy,
            receivedOn: queue.receivedOn,
            today: todayInSpain(),
          });
          if (result.approved) {
            console.info("[comparador] anexo aprobado solo", { tenantSlug, id, versionId: result.versionId });
            if (!result.pendingIngestId) {
              const approved = await getIngest(client, id);
              if (approved) await notifyPricesUpdated({ client, ingest: approved, tenantSlug, request });
            }
          } else {
            console.warn("[comparador] anexo sin aprobar", { tenantSlug, id, reason: result.reason });
          }
        }
      }
    } catch (error) {
      console.error("[comparador] inbound processing failed", id, error);
    }
  }

  // Después del primero, no a la vez: los anexos de una misma comercializadora
  // encadenan versiones y no pueden aprobarse a la vez.
  if (rest.length === 0) return;
  const body = JSON.stringify({ ...queue, ids: rest } satisfies InboundQueue);
  try {
    const response = await fetch(continueUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [INBOUND_QUEUE_SIGNATURE_HEADER]: signInboundQueue(body, secret),
      },
      body,
    });
    if (!response.ok) throw new Error(`${response.status}`);
  } catch (error) {
    console.error("[comparador] la cola del buzón no ha podido seguir", { tenantSlug, pending: rest, error });
  }
}
