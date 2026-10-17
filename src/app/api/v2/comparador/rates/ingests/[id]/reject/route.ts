import { after, NextRequest } from "next/server";
import { notifyPricesUpdated } from "@/comparador/rates/notify-prices-updated";
import { getIngest } from "@/comparador/rates/repository";
import { RateIngestError, rejectIngest } from "@/comparador/rates/service";
import { ok, ratesError, requireNegocoReview, requireRatesAccess } from "@/comparador/server/rates-route";

/** Descarta una ingesta sin tocar los precios. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    requireNegocoReview(access.context);
    const { id } = await params;

    const ingest = await getIngest(access.context.client, id);
    if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);

    const { client, tenantSlug } = access.context;
    await rejectIngest({ client, ingest, user: access.context.user });
    // Descartar lo que se apartó de un anexo también lo da por terminado.
    after(() => notifyPricesUpdated({ client, ingest, tenantSlug, request }));
    return ok({ id });
  } catch (error) {
    return ratesError("reject ingest", error);
  }
}
