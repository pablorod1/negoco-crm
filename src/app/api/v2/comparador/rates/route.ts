import { NextRequest } from "next/server";
import { RateIngestError, todayInSpain } from "@/comparador/rates/service";
import { inboundDomain } from "@/comparador/rates/inbound";
import { getSupplierRatesView } from "@/comparador/rates/views";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

/** Vista «Tarifas» de una comercializadora: catálogo, versión activa, historial e ingestas. */
export async function GET(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;

    const comercializadoraId = request.nextUrl.searchParams.get("comercializadora_id");
    if (!comercializadoraId) throw new RateIngestError("Falta comercializadora_id");

    const view = await getSupplierRatesView({
      client: access.context.client,
      comercializadoraId,
      today: todayInSpain(),
    });
    // El buzón de anexos de este tenant: enviar un correo es la forma de actualizar precios.
    const domain = inboundDomain(process.env.COMPARADOR_INBOUND_DOMAIN);
    return ok({
      ...view,
      mailbox: domain ? `${access.context.tenantSlug}@${domain}` : null,
      canManage: access.context.canManage,
      canManageCatalog: access.context.canManageCatalog,
    });
  } catch (error) {
    return ratesError("rates view", error);
  }
}
