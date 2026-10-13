import { NextRequest } from "next/server";
import { RateIngestError, todayInSpain } from "@/comparador/rates/service";
import { inboundDomain } from "@/comparador/rates/inbound";
import { getSupplierRatesView } from "@/comparador/rates/views";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";
import { getDefaultAncillary } from "@/comparador/study/settings";

/** Vista «Tarifas» de una comercializadora: catálogo, versión activa, historial e ingestas. */
export async function GET(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;

    const comercializadoraId = request.nextUrl.searchParams.get("comercializadora_id");
    if (!comercializadoraId) throw new RateIngestError("Falta comercializadora_id");

    const [view, ancillaryDefault] = await Promise.all([
      getSupplierRatesView({
        client: access.context.client,
        comercializadoraId,
        today: todayInSpain(),
      }),
      getDefaultAncillary(access.context.client),
    ]);
    // El buzón de anexos de este tenant: enviar un correo es la forma de actualizar precios.
    const domain = inboundDomain(process.env.COMPARADOR_INBOUND_DOMAIN);
    return ok({
      ...view,
      mailbox: domain ? `${access.context.tenantSlug}@${domain}` : null,
      // SSAA con los que se ofertan las tarifas que los cobran aparte.
      ancillaryDefault,
      canManage: access.context.canManage,
      canManageCatalog: access.context.canManageCatalog,
    });
  } catch (error) {
    return ratesError("rates view", error);
  }
}
