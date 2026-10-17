import { NextRequest } from "next/server";
import { getIngest } from "@/comparador/rates/repository";
import { RateIngestError } from "@/comparador/rates/service";
import { processIngestById } from "@/comparador/server/ingest-review";
import { ok, ratesError, requireNegocoReview, requireRatesAccess } from "@/comparador/server/rates-route";

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
    // Leer un anexo recién subido es del tenant; volver a leerlo, de Negoco.
    if (ingest.status !== "received") requireNegocoReview(access.context);

    return ok(await processIngestById({ client, id, userId: user.id, tenantSlug, request }));
  } catch (error) {
    return ratesError("process ingest", error);
  }
}
