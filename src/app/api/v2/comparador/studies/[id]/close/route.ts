import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { storage } from "@/core/firebase/firebaseConfig";
import { proposalBranding } from "@/comparador/pdf/branding";
import { renderProposalPdf } from "@/comparador/pdf/proposal-pdf";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import { loadStudy, studyError } from "@/comparador/server/study-route";
import { closeStudy, type ProposalUploader } from "@/comparador/study/close";
import { getProposal } from "@/comparador/study/proposals";
import { StudyError } from "@/comparador/study/service";

const CloseSchema = z.object({ proposalId: z.string().min(1) });

const uploadToStorage: ProposalUploader = async ({ path, data }) => {
  const target = ref(storage, path);
  await uploadBytes(target, data, { contentType: "application/pdf" });
  return { downloadUrl: await getDownloadURL(target), remove: () => deleteObject(target) };
};

/**
 * Completa el estudio con la propuesta elegida: su PDF pasa a los documentos
 * de la comparativa y la comparativa queda pendiente de revisión.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const { client, user } = access.context;
    const study = await loadStudy(access.context, id);

    const parsed = CloseSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Elige una propuesta" }, { status: 400 });
    const proposal = await getProposal(client, parsed.data.proposalId);
    if (!proposal || proposal.studyId !== study.id) {
      throw new StudyError("Esa propuesta no es de este estudio.", 404);
    }

    const pdf = await renderProposalPdf(proposal.document, await proposalBranding(request));
    const { fileId } = await closeStudy({
      client,
      study,
      proposal,
      pdf: new Uint8Array(pdf),
      userId: user.id,
      upload: uploadToStorage,
    });
    return NextResponse.json({ success: true, data: { fileId } });
  } catch (error) {
    return studyError("close study", error);
  }
}
