import { getDocumentProxy } from "unpdf";

/** Un trozo de texto del PDF con su posición en la página. */
export interface PositionedText {
  text: string;
  x: number;
  y: number;
  width: number;
}

/** Diferencia de altura por debajo de la cual dos trozos van en la misma línea. */
const SAME_LINE = 2.5;

/**
 * Junta los trozos de una página en líneas de lectura, como `pdftotext`: los
 * de la misma altura en una línea, de izquierda a derecha, con un espacio
 * cuando hay hueco entre ellos. pdf.js los da sueltos y, unidos sin más, las
 * cifras de una tabla salen pegadas («0,1648660,196967»), que es justo lo que
 * leen el anonimizado y la extracción.
 */
export function layoutLines(items: readonly PositionedText[]): string[] {
  const sorted = items
    .filter(({ text }) => text.trim())
    .sort((left, right) => right.y - left.y || left.x - right.x);

  const lines: PositionedText[][] = [];
  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate[0].y - item.y) <= SAME_LINE);
    if (line) line.push(item);
    else lines.push([item]);
  }

  return lines
    .sort((left, right) => right[0].y - left[0].y)
    .map((line) => {
      const ordered = [...line].sort((left, right) => left.x - right.x);
      let text = "";
      let end: number | null = null;
      for (const item of ordered) {
        const gap = end === null ? 0 : item.x - end;
        if (text && gap > 0.5) text += " ";
        text += item.text;
        end = item.x + item.width;
      }
      return text.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

export interface InvoiceText {
  /** Texto con una línea por renglón de la factura; null si es escaneada. */
  text: string | null;
  pages: number;
}

/** Texto de una factura en PDF, renglón a renglón. */
export async function invoiceTextFromPdf(data: Uint8Array): Promise<InvoiceText> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const pages: string[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const items: PositionedText[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      items.push({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
      });
    }
    pages.push(layoutLines(items).join("\n"));
  }
  const text = pages.join("\n\n");
  // Menos de 200 caracteres por página: escaneada o casi todo imagen.
  const chars = text.replace(/\s+/g, "").length;
  return { text: chars >= 200 * Math.max(pdf.numPages, 1) ? text : null, pages: pdf.numPages };
}
