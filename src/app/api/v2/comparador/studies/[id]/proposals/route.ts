import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentTariffFromInvoice } from "@/comparador/extraction/current-tariff";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import {
  canSeeAgencyCommission,
  loadStudyWithComparativa,
  OptionsSchema,
  proposalView,
  studyError,
} from "@/comparador/server/study-route";
import { createProposal, findSameProposal, listProposals } from "@/comparador/study/proposals";
import { rankSavedStudy, StudyError } from "@/comparador/study/service";

const ProposalSchema = z.object({
  offerKey: z.string().min(1),
  options: OptionsSchema.optional(),
});

/**
 * Genera la propuesta de una oferta del ranking con las opciones con las que
 * se ha visto (fee, canal). Se recalcula en el servidor: lo que va al PDF no
 * sale del navegador. Si ya hay una igual, se devuelve esa.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const { client, user } = access.context;
    const { study, comparativa } = await loadStudyWithComparativa(access.context, id);
    if (study.status === "closed") throw new StudyError("Este estudio ya está completado.", 409);

    const parsed = ProposalSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Propuesta no válida" }, { status: 400 });
    const wanted = Object.fromEntries(
      Object.entries(parsed.data.options ?? {}).filter(([, value]) => value !== undefined),
    );

    const { ranking } = await rankSavedStudy({ client, study, options: wanted });
    const offer = ranking.offers.find(({ key }) => key === parsed.data.offerKey);
    if (!offer) {
      throw new StudyError("Esa tarifa ya no está entre las que encajan con este suministro.", 409);
    }

    const showCommission = canSeeAgencyCommission(user.role);
    const existing = findSameProposal(await listProposals(client, id), offer);
    if (existing) {
      return NextResponse.json({ success: true, data: proposalView(existing, showCommission) });
    }
    const proposal = await createProposal(client, {
      study,
      offer,
      current: ranking.current,
      currentPrices: study.extraction ? (currentTariffFromInvoice(study.extraction)?.prices ?? null) : null,
      clientName: comparativa.clientName,
      createdBy: user.id,
    });
    return NextResponse.json({ success: true, data: proposalView(proposal, showCommission) });
  } catch (error) {
    return studyError("create proposal", error);
  }
}
