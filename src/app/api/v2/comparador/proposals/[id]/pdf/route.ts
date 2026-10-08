import { NextRequest, NextResponse } from "next/server";
import { proposalBranding } from "@/comparador/pdf/branding";
import { renderProposalPdf } from "@/comparador/pdf/proposal-pdf";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import { loadStudy, studyError } from "@/comparador/server/study-route";
import { getProposal, proposalFileName } from "@/comparador/study/proposals";

/** El PDF de una propuesta, para verlo en el navegador. Se genera desde su foto. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const proposal = await getProposal(access.context.client, id);
    if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
    // Comprueba que la comparativa del estudio es de las que este usuario ve.
    await loadStudy(access.context, proposal.studyId);

    const pdf = await renderProposalPdf(proposal.document, await proposalBranding(request));
    const name = proposalFileName(proposal);
    // La cabecera solo admite ASCII; el nombre con tildes va en filename*.
    const ascii = name.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return studyError("render proposal pdf", error);
  }
}
