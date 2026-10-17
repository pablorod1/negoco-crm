import { NextRequest } from "next/server";
import { z } from "zod";
import { RateIngestError } from "@/comparador/rates/service";
import { assignIngestSupplier, getIngestDetail } from "@/comparador/server/ingest-review";
import { ok, ratesError, requireNegocoReview, requireRatesAccess } from "@/comparador/server/rates-route";

type Params = { params: Promise<{ id: string }> };

/** Una ingesta con su revisión frente a la versión activa de hoy. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    return ok({
      ...(await getIngestDetail(access.context.client, id)),
      canManage: access.context.canManage,
      canManageCatalog: access.context.canManageCatalog,
    });
  } catch (error) {
    return ratesError("get ingest", error);
  }
}

const PatchSchema = z.object({ comercializadora_id: z.string().min(1) });

/**
 * Asigna la comercializadora a una ingesta que llegó sin ella (un correo que
 * no la nombra). Después hay que procesarla de nuevo.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    requireNegocoReview(access.context);
    const { id } = await params;
    const parsed = PatchSchema.safeParse(await request.json());
    if (!parsed.success) throw new RateIngestError("Falta comercializadora_id");
    return ok(await assignIngestSupplier(access.context.client, id, parsed.data.comercializadora_id));
  } catch (error) {
    return ratesError("assign ingest supplier", error);
  }
}
