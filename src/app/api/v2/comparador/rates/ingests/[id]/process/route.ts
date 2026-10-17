import { NextRequest } from "next/server";
import { getTursoControlClient } from "@/core/libsql/client";
import { getIngest } from "@/comparador/rates/repository";
import { autoApproveIngest, dayInSpain, processIngest, RateIngestError, todayInSpain } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

/** La extracción de un anexo largo (Iberdrola, Axpo) tarda hasta un par de minutos. */
export const maxDuration = 300;

/**
 * Clasifica y extrae el documento de una ingesta. Gasta crédito de la IA. Si
 * la lectura sale limpia, se aprueba sola como en el buzón: lo que envía el
 * tenant (por correo o subido) no tiene que revisarlo nadie.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const { client, tenantSlug, user } = access.context;

    const ingest = await getIngest(client, id);
    if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);

    const status = await processIngest({ client, ingest, tenantSlug, userId: user.id });
    if (status !== "ready" && status !== "needs_review") return ok({ id, status });

    const read = await getIngest(client, id);
    const result = await autoApproveIngest({
      client,
      control: getTursoControlClient(),
      ingest: read!,
      approvedBy: user.id,
      // Sin fecha en el documento, la del día en que llegó (en España).
      receivedOn: dayInSpain(ingest.receivedAt),
      today: todayInSpain(),
    });
    return ok({ id, status: result.approved ? "approved" : status });
  } catch (error) {
    return ratesError("process ingest", error);
  }
}
