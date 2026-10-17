import { NextRequest } from "next/server";
import { RateIngestError } from "@/comparador/rates/service";
import { ApprovalSchema, approveIngestById } from "@/comparador/server/ingest-review";
import { ok, ratesError, requireNegocoReview, requireRatesAccess } from "@/comparador/server/rates-route";

/**
 * Aprueba una ingesta: guarda la versión de precios (activa o programada) y
 * las comisiones, y da de alta en el catálogo los productos nuevos, como el
 * buzón cuando aprueba solo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    requireNegocoReview(access.context);
    const { id } = await params;
    const parsed = ApprovalSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new RateIngestError("Indica la fecha de entrada en vigor (AAAA-MM-DD).");
    }
    const { client, user, tenantSlug } = access.context;
    return ok(await approveIngestById({ client, id, input: parsed.data, userId: user.id, tenantSlug, request }));
  } catch (error) {
    return ratesError("approve ingest", error);
  }
}
