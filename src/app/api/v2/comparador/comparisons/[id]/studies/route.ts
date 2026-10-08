import { NextRequest, NextResponse } from "next/server";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import { studyError } from "@/comparador/server/study-route";
import { getStudyComparativa, listComparativaPdfs } from "@/comparador/study/comparativa";
import { listStudies } from "@/comparador/study/repository";
import { analyzeInvoice, StudyError, type SipsFetcher } from "@/comparador/study/service";
import { todayInSpain } from "@/comparador/rates/service";
import { fetchApoloSipsProcedure } from "@/integrations/apolo-sips/server";

// Texto del PDF, extracción con la IA (en cascada) y dos consultas al SIPS.
export const maxDuration = 120;

/** Facturas de más de 15 MB no son facturas de luz. */
const MAX_INVOICE_BYTES = 15 * 1024 * 1024;

const fetchSips: SipsFetcher = async (cups, procedure) => {
  const apiKey = process.env.APOLO_SIPS_API_KEY;
  if (!apiKey) return null;
  return fetchApoloSipsProcedure({ apiKey, cups, procedure, supplyType: "ELECTRICIDAD" });
};

/** Estudios de la comparativa y los PDF que tiene adjuntos para analizar. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const { client, user } = access.context;
    const comparativa = await getStudyComparativa(client, id, user);
    if (!comparativa) return NextResponse.json({ error: "Comparativa no encontrada" }, { status: 404 });

    const [studies, pdfs] = await Promise.all([listStudies(client, id), listComparativaPdfs(client, id)]);
    return NextResponse.json(
      {
        success: true,
        data: {
          service: comparativa.service,
          clientName: comparativa.clientName,
          pdfs: pdfs.map(({ id: fileId, filename, uploadDate, downloadUrl }) => ({ id: fileId, filename, uploadDate, downloadUrl })),
          studies: studies.map((study) => ({
            id: study.id,
            status: study.status,
            createdAt: study.createdAt,
            invoiceFileName: study.invoiceFileName,
            savings: study.savings,
            chosenProduct: study.chosenOffer
              ? `${study.chosenOffer.comercializadoraName} · ${study.chosenOffer.productName}`
              : null,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return studyError("list studies", error);
  }
}

/** Analiza una factura: un PDF adjunto a la comparativa (`fileId`) o uno nuevo (`file`). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const { client, user, tenantSlug } = access.context;
    const comparativa = await getStudyComparativa(client, id, user);
    if (!comparativa) return NextResponse.json({ error: "Comparativa no encontrada" }, { status: 404 });
    if (comparativa.service !== "Luz") {
      throw new StudyError("El comparador propio compara luz 2.0TD; esta comparativa es de gas.");
    }

    const form = await request.formData();
    const fileId = form.get("fileId");
    const upload = form.get("file");

    let invoice;
    if (typeof fileId === "string" && fileId) {
      const pdf = (await listComparativaPdfs(client, id)).find((file) => file.id === fileId);
      if (!pdf) throw new StudyError("Ese PDF no está adjunto a la comparativa.", 404);
      const download = await fetch(pdf.downloadUrl);
      if (!download.ok) throw new StudyError("No se ha podido descargar la factura adjunta.", 502);
      invoice = {
        data: new Uint8Array(await download.arrayBuffer()),
        fileName: pdf.filename,
        fileId: pdf.id,
        mime: "application/pdf",
      };
    } else if (upload instanceof File) {
      if (upload.size > MAX_INVOICE_BYTES) throw new StudyError("La factura pesa más de 15 MB.");
      invoice = {
        data: new Uint8Array(await upload.arrayBuffer()),
        fileName: upload.name,
        fileId: null,
        mime: upload.type,
      };
    } else {
      throw new StudyError("Elige una factura adjunta o sube el PDF.", 400);
    }

    const studyId = await analyzeInvoice({
      client,
      tenantSlug,
      comparativaId: id,
      userId: user.id,
      invoice,
      channel: comparativa.hasRenovacion ? "renewal" : "acquisition",
      today: todayInSpain(),
      fetchSips,
    });
    return NextResponse.json({ success: true, data: { id: studyId } });
  } catch (error) {
    return studyError("analyze invoice", error);
  }
}
