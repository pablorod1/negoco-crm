import { OcrTimeoutError, ocrImages, pdfPagesAsImages, prepareImage, UnreadableImageError } from "@/comparador/ocr/ocr";
import { invoiceTextFromPdf } from "./invoice-text";
import { StudyError } from "./errors";

/** Formatos de imagen que se leen con OCR (lo que abre sharp). */
const IMAGE = /^image\/(jpe?g|png|webp|tiff|gif|heic|heif)$/i;
const IMAGE_FILE = /\.(jpe?g|png|webp|tiff?|gif|heic|heif)$/i;

/** Por debajo de esto, Tesseract no ha leído la factura de verdad. */
const MIN_OCR_CONFIDENCE = 60;
const MIN_OCR_CHARS = 400;

export const isInvoiceImage = (mime: string, fileName: string) => IMAGE.test(mime) || IMAGE_FILE.test(fileName);
export const isInvoicePdf = (mime: string, fileName: string) => mime === "application/pdf" || /\.pdf$/i.test(fileName);

export interface InvoiceReading {
  /** Texto renglón a renglón; si viene de OCR, las columnas van separadas por un tabulador. */
  text: string;
  /** Leída con OCR (foto o PDF escaneado): las cifras se revisan contra el original. */
  fromImage: boolean;
}

/**
 * El texto de una factura, siempre dentro del CRM: el de un PDF tal cual y el
 * de una foto o un PDF escaneado con OCR local. Si el OCR no lee bien la
 * imagen, se dice por qué en vez de analizar algo dudoso.
 */
export async function readInvoice({
  data,
  mime,
  fileName,
  morePages = [],
}: {
  data: Uint8Array;
  mime: string;
  fileName: string;
  /** Las demás páginas, si la factura llega en varias fotos. */
  morePages?: Uint8Array[];
}): Promise<InvoiceReading> {
  let images: Buffer[];
  if (isInvoicePdf(mime, fileName)) {
    const { text, pages } = await invoiceTextFromPdf(data);
    if (text) return { text, fromImage: false };
    images = await pdfPagesAsImages(data, pages);
  } else if (isInvoiceImage(mime, fileName)) {
    images = [data, ...morePages].map((page) => Buffer.from(page));
  } else {
    throw new StudyError("Sube la factura en PDF o como foto (JPG o PNG).");
  }

  try {
    const prepared = await Promise.all(images.map((image) => prepareImage(image)));
    const ocr = await ocrImages(prepared);
    if (ocr.confidence < MIN_OCR_CONFIDENCE || ocr.text.replace(/\s/g, "").length < MIN_OCR_CHARS) {
      throw new StudyError(
        "La factura no se lee bien en la imagen (borrosa, torcida, cortada o con poca luz). Haz otra foto de frente, con buena luz y la factura entera, o pide el PDF a la comercializadora.",
      );
    }
    return { text: ocr.text, fromImage: true };
  } catch (error) {
    if (error instanceof UnreadableImageError) throw new StudyError(error.message);
    if (error instanceof OcrTimeoutError) {
      console.error("[comparador] OCR", error.message, { pages: images.length, steps: error.steps });
      throw new StudyError(
        "No se ha podido leer la imagen de la factura a tiempo. Vuelve a intentarlo y, si se repite, pide la factura en PDF.",
        503,
      );
    }
    throw error;
  }
}
