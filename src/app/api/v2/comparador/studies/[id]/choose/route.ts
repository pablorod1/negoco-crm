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
import { chooseStudyOffer, getStudy } from "@/comparador/study/repository";
import { rankSavedStudy, StudyError } from "@/comparador/study/service";

const ChoiceSchema = z.object({
  offerKey: z.string().min(1),
  options: OptionsSchema.optional(),
});

/**
 * Elige una oferta del ranking con las opciones con las que se ha visto. Se
 * recalcula en el servidor: lo que se guarda no sale del navegador.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const study = await loadStudy(access.context, id);
    if (study.status === "closed") throw new StudyError("Este estudio ya está cerrado.", 409);

    const parsed = ChoiceSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Elección no válida" }, { status: 400 });
    const wanted = Object.fromEntries(
      Object.entries(parsed.data.options ?? {}).filter(([, value]) => value !== undefined),
    );

    const { ranking, options } = await rankSavedStudy({ client: access.context.client, study, options: wanted });
    const offer = ranking.offers.find(({ key }) => key === parsed.data.offerKey);
    if (!offer) {
      throw new StudyError("Esa tarifa ya no está entre las que encajan con este suministro.", 409);
    }
    await chooseStudyOffer(access.context.client, id, {
      offer,
      currentTotal: ranking.current?.total ?? null,
      options,
    });

    const saved = await getStudy(access.context.client, id);
    return NextResponse.json({
      success: true,
      data: studyView(saved!, ranking, canSeeAgencyCommission(access.context.user.role)),
    });
  } catch (error) {
    return studyError("choose offer", error);
  }
}
