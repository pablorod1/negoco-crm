import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InvoiceExtractionSchema } from "@/comparador/extraction/invoice-schema";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import { loadStudy, studyError } from "@/comparador/server/study-route";
import { saveInvoiceReview } from "@/comparador/study/invoice-review";

const ReviewSchema = z.object({
  invoice: InvoiceExtractionSchema,
  /** Las cuentas no cuadran y quien revisa confirma que es lo que dice la factura. */
  acceptMismatch: z.boolean().optional(),
});

/** Guarda los datos de la factura revisados por quien hace el estudio. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const study = await loadStudy(access.context, id);
    const parsed = ReviewSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Revisa los datos de la factura" }, { status: 400 });
    const { issues } = await saveInvoiceReview({
      client: access.context.client,
      study,
      invoice: parsed.data.invoice,
      acceptMismatch: parsed.data.acceptMismatch ?? false,
      user: access.context.user,
    });
    return NextResponse.json({ success: true, data: { issues: issues.length } });
  } catch (error) {
    return studyError("review invoice", error);
  }
}
