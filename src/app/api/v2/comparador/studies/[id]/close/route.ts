import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uploadToStorage } from "@/comparador/server/storage";
import { proposalBranding } from "@/comparador/pdf/branding";
import { renderProposalPdf } from "@/comparador/pdf/proposal-pdf";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import { loadStudy, studyError } from "@/comparador/server/study-route";
import { MAX_ACCEPTED } from "@/comparador/study/accepted";
import { closeStudy } from "@/comparador/study/close";
import { StudyClientDataSchema } from "@/comparador/study/client-data";
import { getProposal } from "@/comparador/study/proposals";
import { StudyError } from "@/comparador/study/service";

const CloseSchema = z
  .object({
    /** Las propuestas que acepta el cliente; la primera es la principal. */
    proposalIds: z.array(z.string().min(1)).min(1).max(MAX_ACCEPTED).optional(),
    /** Una sola, como antes de poder aceptar varias. */
    proposalId: z.string().min(1).optional(),
    client: StudyClientDataSchema.nullable().optional(),
  })
  .refine(({ proposalIds, proposalId }) => proposalIds ?? proposalId, { message: "Elige la propuesta que acepta el cliente." });

/**
 * Completa el estudio con las propuestas que acepta el cliente: sus PDFs pasan
 * a los documentos de la comparativa y la comparativa queda pendiente de revisión.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const { client, user } = access.context;
    const study = await loadStudy(access.context, id);

    const parsed = CloseSchema.safeParse(await request.json());
    if (!parsed.success) {
      // Los mensajes propios (DNI, IBAN, correo…) ya están en español.
      const message = parsed.error.issues.find(({ code }) => code === "custom")?.message;
      return NextResponse.json({ error: message ?? "Revisa la propuesta y los datos del cliente" }, { status: 400 });
    }
    const ids = parsed.data.proposalIds ?? [parsed.data.proposalId!];
    const proposals = await Promise.all(ids.map((proposalId) => getProposal(client, proposalId)));
    if (proposals.some((proposal) => !proposal || proposal.studyId !== study.id)) {
      throw new StudyError("Esa propuesta no es de este estudio.", 404);
    }

    const branding = await proposalBranding(request);
    const accepted = await Promise.all(
      proposals.map(async (proposal) => ({ proposal: proposal!, pdf: new Uint8Array(await renderProposalPdf(proposal!.document, branding)) })),
    );
    const { fileIds } = await closeStudy({
      client,
      study,
      accepted,
      userId: user.id,
      upload: uploadToStorage,
      clientData: parsed.data.client ?? null,
    });
    return NextResponse.json({ success: true, data: { fileIds } });
  } catch (error) {
    return studyError("close study", error);
  }
}
