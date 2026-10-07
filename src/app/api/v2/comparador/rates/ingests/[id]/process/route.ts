import { NextRequest } from "next/server";
import { getIngest } from "@/comparador/rates/repository";
import { processIngest, RateIngestError } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

/** La extracción de un anexo largo (Iberdrola, Axpo) tarda hasta un par de minutos. */
export const maxDuration = 300;

/** Clasifica y extrae el documento de una ingesta. Gasta crédito de la IA. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRatesAccess(request, { manage: true });
    if (!access.ok) return access.response;
    const { id } = await params;
    const { client, tenantSlug, user } = access.context;

    const ingest = await getIngest(client, id);
    if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);

    const status = await processIngest({ client, ingest, tenantSlug, userId: user.id });
    return ok({ id, status });
  } catch (error) {
    return ratesError("process ingest", error);
  }
}
