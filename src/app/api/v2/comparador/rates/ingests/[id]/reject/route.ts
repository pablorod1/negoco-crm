import { NextRequest } from "next/server";
import { getIngest } from "@/comparador/rates/repository";
import { RateIngestError, rejectIngest } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

/** Descarta una ingesta sin tocar los precios. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRatesAccess(request, { manage: true });
    if (!access.ok) return access.response;
    const { id } = await params;

    const ingest = await getIngest(access.context.client, id);
    if (!ingest) throw new RateIngestError("Ingesta no encontrada", 404);

    await rejectIngest({ client: access.context.client, ingest, user: access.context.user });
    return ok({ id });
  } catch (error) {
    return ratesError("reject ingest", error);
  }
}
