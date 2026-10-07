import { NextRequest } from "next/server";
import {
  discardScheduledVersion,
  getVersionPrices,
} from "@/comparador/rates/repository";
import { RateIngestError } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";

type Params = { params: Promise<{ id: string }> };

/** Precios de una versión (activa, programada o del historial). */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const access = await requireRatesAccess(request, { manage: false });
    if (!access.ok) return access.response;
    const { id } = await params;
    return ok(await getVersionPrices(access.context.client, id));
  } catch (error) {
    return ratesError("version prices", error);
  }
}

/** Descarta una versión programada que aún no ha entrado en vigor. */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const access = await requireRatesAccess(request, { manage: true });
    if (!access.ok) return access.response;
    const { id } = await params;
    const comercializadoraId = request.nextUrl.searchParams.get("comercializadora_id");
    if (!comercializadoraId) throw new RateIngestError("Falta comercializadora_id");

    const discarded = await discardScheduledVersion(access.context.client, {
      versionId: id,
      comercializadoraId,
    });
    if (!discarded) {
      throw new RateIngestError("Solo se pueden descartar versiones programadas.", 409);
    }
    return ok({ id });
  } catch (error) {
    return ratesError("discard version", error);
  }
}
