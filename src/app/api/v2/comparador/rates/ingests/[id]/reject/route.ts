import { NextRequest } from "next/server";
import { rejectIngestById } from "@/comparador/server/ingest-review";
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
    const { client, user, tenantSlug } = access.context;
    return ok(await rejectIngestById({ client, id, userId: user.id, tenantSlug, request }));
  } catch (error) {
    return ratesError("reject ingest", error);
  }
}
