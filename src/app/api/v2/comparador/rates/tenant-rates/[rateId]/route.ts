import { NextRequest } from "next/server";
import { z } from "zod";
import { setTenantRateEnabled } from "@/comparador/rates/repository";
import { RateIngestError } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

const BodySchema = z.object({
  comercializadora_id: z.string().min(1),
  enabled: z.boolean(),
});

/** Activa o desactiva una tarifa en el tenant: desactivada no entra en el ranking. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ rateId: string }> },
) {
  try {
    const access = await requireRatesAccess(request, { manage: true });
    if (!access.ok) return access.response;
    const { rateId } = await params;
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) throw new RateIngestError("Datos no válidos");

    await setTenantRateEnabled(access.context.client, {
      rateId,
      comercializadoraId: parsed.data.comercializadora_id,
      enabled: parsed.data.enabled,
    });
    return ok({ rateId, enabled: parsed.data.enabled });
  } catch (error) {
    return ratesError("toggle tenant rate", error);
  }
}
