import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import {
  canSeeAgencyCommission,
  loadStudy,
  OptionsSchema,
  studyError,
  studyView,
} from "@/comparador/server/study-route";
import { listProposals } from "@/comparador/study/proposals";
import { saveStudyOptions } from "@/comparador/study/repository";
import { rankSavedStudy } from "@/comparador/study/service";

function optionsFromQuery(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const fee = query.get("fee");
  return OptionsSchema.parse({
    channel: query.has("channel") ? query.get("channel") || null : undefined,
    feeEnergyPerMwh: fee === null ? undefined : fee === "" ? null : Number(fee),
    order: query.get("order") ?? undefined,
  });
}

/** El estudio con su ranking; `?fee=`, `?order=` y `?channel=` prueban otras opciones sin guardarlas. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const study = await loadStudy(access.context, id);
    const parsed = optionsFromQuery(request);
    const [{ ranking, options }, proposals] = await Promise.all([
      rankSavedStudy({
        client: access.context.client,
        study,
        options: Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined)),
      }),
      listProposals(access.context.client, id),
    ]);
    return NextResponse.json(
      {
        success: true,
        data: studyView({ ...study, options }, ranking, canSeeAgencyCommission(access.context.user.role), proposals),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Opciones no válidas" }, { status: 400 });
    }
    return studyError("view study", error);
  }
}

/** Guarda las opciones del estudio (fee, canal, orden). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const study = await loadStudy(access.context, id);
    const parsed = OptionsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Opciones no válidas" }, { status: 400 });
    const options = {
      ...study.options,
      ...Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)),
    };
    await saveStudyOptions(access.context.client, id, options);
    return NextResponse.json({ success: true, data: { options } });
  } catch (error) {
    return studyError("save study options", error);
  }
}
