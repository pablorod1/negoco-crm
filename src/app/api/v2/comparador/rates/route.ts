import { NextRequest } from "next/server";
import { getTursoControlClient } from "@/core/libsql/client";
import { RateIngestError, todayInSpain } from "@/comparador/rates/service";
import { getSupplierRatesView } from "@/comparador/rates/views";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

/** Vista «Tarifas» de una comercializadora: catálogo, versión activa, historial e ingestas. */
export async function GET(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request, { manage: false });
    if (!access.ok) return access.response;

    const comercializadoraId = request.nextUrl.searchParams.get("comercializadora_id");
    if (!comercializadoraId) throw new RateIngestError("Falta comercializadora_id");

    const view = await getSupplierRatesView({
      client: access.context.client,
      control: getTursoControlClient(),
      comercializadoraId,
      today: todayInSpain(),
    });
    return ok({
      ...view,
      canManage: access.context.canManage,
      canManageCatalog: access.context.canManageCatalog,
    });
  } catch (error) {
    return ratesError("rates view", error);
  }
}
