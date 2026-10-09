import { NextRequest, NextResponse } from "next/server";
import { requireNegocoStudiesAccess } from "@/comparador/server/guard";
import { studyError } from "@/comparador/server/study-route";
import { uploadToStorage } from "@/comparador/server/storage";
import { getStudyComparativa, listComparativaInvoices } from "@/comparador/study/comparativa";
import { attachUploadedInvoice } from "@/comparador/study/invoice-file";
import { isValidCups, normalizeIdentifier } from "@/comparador/extraction/identifiers";
import { isInvoiceImage } from "@/comparador/study/read-invoice";
import { listStudies } from "@/comparador/study/repository";
import { analyzeInvoice, StudyError, type SipsFetcher } from "@/comparador/study/service";
import { todayInSpain } from "@/comparador/rates/service";
import { fetchApoloSipsProcedure } from "@/integrations/apolo-sips/server";

// Texto del PDF u OCR de la imagen, dos consultas al SIPS y extracción con la IA (en cascada).
export const maxDuration = 120;

/** Facturas de más de 15 MB no son facturas de luz. */
const MAX_INVOICE_BYTES = 15 * 1024 * 1024;
/** Fotos de una factura: una por página. */
const MAX_PHOTOS = 6;

const fetchSips: SipsFetcher = async (cups, procedure) => {
  const apiKey = process.env.APOLO_SIPS_API_KEY;
  if (!apiKey) return null;
  return fetchApoloSipsProcedure({ apiKey, cups, procedure, supplyType: "ELECTRICIDAD" });
};

/** Estudios de la comparativa y las facturas (PDF o foto) que tiene adjuntas para analizar. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireNegocoStudiesAccess(request);
    if (!access.ok) return access.response;
    const { id } = await params;
    const { client, user } = access.context;
    const comparativa = await getStudyComparativa(client, id, user);
    if (!comparativa) return NextResponse.json({ error: "Comparativa no encontrada" }, { status: 404 });

    const [studies, invoices] = await Promise.all([listStudies(client, id), listComparativaInvoices(client, id)]);
    return NextResponse.json(
      {
        success: true,
        data: {
          service: comparativa.service,
          clientName: comparativa.clientName,
          invoices,
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
    const uploads = form.getAll("file").filter((entry): entry is File => entry instanceof File);
    // CUPS escrito a mano cuando la factura no lo trae legible.
    const typedCups = typeof form.get("cups") === "string" ? normalizeIdentifier(form.get("cups") as string) : "";
    if (typedCups && !isValidCups(typedCups)) {
      throw new StudyError("Ese CUPS no es válido: revisa los números y las dos letras de control.", 422, "cups_missing");
    }

    let invoice;
    if (typeof fileId === "string" && fileId) {
      const attached = (await listComparativaInvoices(client, id)).find((file) => file.id === fileId);
      if (!attached) throw new StudyError("Esa factura no está adjunta a la comparativa.", 404);
      const download = await fetch(attached.downloadUrl);
      if (!download.ok) throw new StudyError("No se ha podido descargar la factura adjunta.", 502);
      invoice = {
        data: new Uint8Array(await download.arrayBuffer()),
        fileName: attached.filename,
        fileId: attached.id,
        mime: attached.extension === "pdf" ? "application/pdf" : `image/${attached.extension === "jpg" ? "jpeg" : attached.extension}`,
      };
    } else if (uploads.length > 0) {
      if (uploads.length > MAX_PHOTOS) throw new StudyError(`Sube como mucho ${MAX_PHOTOS} fotos, una por página.`);
      if (uploads.some((upload) => upload.size > MAX_INVOICE_BYTES)) throw new StudyError("La factura pesa más de 15 MB.");
      if (uploads.length > 1 && uploads.some((upload) => !isInvoiceImage(upload.type, upload.name))) {
        throw new StudyError("Sube un solo PDF, o varias fotos de la misma factura (una por página).");
      }
      const [first, ...rest] = uploads;
      invoice = {
        data: new Uint8Array(await first.arrayBuffer()),
        fileName: first.name,
        fileId: null,
        mime: first.type,
        morePages: await Promise.all(rest.map(async (upload) => new Uint8Array(await upload.arrayBuffer()))),
      };
    } else {
      throw new StudyError("Elige una factura adjunta o súbela (PDF o foto).", 400);
    }

    const studyId = await analyzeInvoice({
      client,
      tenantSlug,
      comparativaId: id,
      userId: user.id,
      invoice: { ...invoice, cups: typedCups || null },
      channel: comparativa.hasRenovacion ? "renewal" : "acquisition",
      today: todayInSpain(),
      fetchSips,
    });
    // Lo subido pasa a los documentos (cada foto, una página); si falla, el estudio vale igual.
    for (const [index, upload] of uploads.entries()) {
      await attachUploadedInvoice({
        client,
        comparativaId: id,
        // El estudio enlaza la primera página: la que se abre con «Ver factura».
        studyId: index === 0 ? studyId : null,
        invoice: { data: new Uint8Array(await upload.arrayBuffer()), fileName: upload.name, mime: upload.type },
        userId: user.id,
        upload: uploadToStorage,
      }).catch((error) => console.error("[comparador] attach uploaded invoice", error));
    }
    return NextResponse.json({ success: true, data: { id: studyId } });
  } catch (error) {
    return studyError("analyze invoice", error);
  }
}
