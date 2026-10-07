import { NextRequest } from "next/server";
import { getRatesOverview } from "@/comparador/rates/views";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

/** Comercializadoras sin actualizar, ingestas pendientes y tiempo hasta aprobar. */
export async function GET(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request, { manage: false });
    if (!access.ok) return access.response;
    return ok(await getRatesOverview(access.context.client));
  } catch (error) {
    return ratesError("rates overview", error);
  }
}
