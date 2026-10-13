import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AncillarySchema } from "@/comparador/server/study-route";
import { ok, ratesError, requireRatesAccess } from "@/comparador/server/rates-route";
import { cleanAncillary, setDefaultAncillary, SettingsUnavailableError } from "@/comparador/study/settings";

const SettingsSchema = z.object({ ancillaryDefault: AncillarySchema.nullable() });

/** Ajustes del comparador del tenant: los SSAA por defecto (dirección y backoffice). */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireRatesAccess(request);
    if (!access.ok) return access.response;
    const parsed = SettingsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Valores no válidos" }, { status: 400 });
    const value = cleanAncillary(parsed.data.ancillaryDefault);
    await setDefaultAncillary(access.context.client, value, access.context.user.id);
    return ok({ ancillaryDefault: value });
  } catch (error) {
    if (error instanceof SettingsUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return ratesError("save comparador settings", error);
  }
}
