import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getComercializadora } from "@/comparador/rates/repository";
import { RateIngestError } from "@/comparador/rates/service";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";
import { getFeePolicies, setFeePolicy, SettingsUnavailableError } from "@/comparador/study/settings";

const fee = z.number().min(0).max(500).nullable();
const FeeSchema = z.object({
  /** null: el fee habitual general, para las comercializadoras sin uno propio. */
  comercializadoraId: z.string().min(1).nullable(),
  habitual: fee,
  max: fee.optional(),
});

/**
 * Fee que la agencia suma a los precios base: el habitual y el máximo de una
 * comercializadora, o el habitual general (dirección y backoffice).
 */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    const parsed = FeeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Valores no válidos" }, { status: 400 });

    const { client, user } = access.context;
    const { comercializadoraId, habitual, max } = parsed.data;
    if (comercializadoraId && !(await getComercializadora(client, comercializadoraId))) {
      throw new RateIngestError("Comercializadora no encontrada", 404);
    }
    await setFeePolicy(client, comercializadoraId, { habitual, max: max ?? null }, user.id);
    return ok(await getFeePolicies(client));
  } catch (error) {
    if (error instanceof SettingsUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return ratesError("save fee policy", error);
  }
}
