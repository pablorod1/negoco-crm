import type { Client } from "@libsql/client";
import type { InvoiceExtraction } from "@/comparador/extraction/invoice-schema";
import { hasBlockingIssues, validateInvoice, type InvoiceIssue } from "@/comparador/extraction/validate";
import { StudyError } from "./errors";
import type { StudyRecord } from "./repository";

/**
 * Revisión de lo leído en la factura por quien hace el estudio. Va dentro del
 * propio JSON de la extracción (sin migración), con la lectura original de
 * la IA para poder ver qué se cambió.
 */
export interface InvoiceReview {
  reviewedBy: string;
  reviewedByEmail: string | null;
  reviewedAt: string;
  /** Las cuentas no cuadran y la persona confirma que es lo que dice la factura. */
  acceptedMismatch: boolean;
  /** Lo que leyó la IA, antes de la primera revisión. */
  original: InvoiceExtraction;
}

export type ReviewedExtraction = InvoiceExtraction & { review?: InvoiceReview };

/** Los avisos que no son de las cuentas (por ejemplo, «leída de una imagen») se conservan. */
const KEPT_CODES = new Set<InvoiceIssue["code"]>(["read_from_image"]);

/**
 * Un estudio abierto cuya lectura no cuadra y que nadie ha revisado: no se
 * enseña lo que paga hoy ni el ahorro hasta que alguien revise la factura.
 */
export function needsInvoiceReview(study: Pick<StudyRecord, "status" | "issues" | "extraction">): boolean {
  if (study.status === "closed") return false;
  const extraction = study.extraction as ReviewedExtraction | null;
  return hasBlockingIssues(study.issues) && !extraction?.review;
}

/** Quita la revisión: lo que se valida y lo que usa el cálculo es la factura sin más. */
export function withoutReview(extraction: ReviewedExtraction): InvoiceExtraction {
  const invoice = { ...extraction };
  delete invoice.review;
  return invoice;
}

/**
 * Guarda los datos de la factura revisados. Se vuelven a validar: si las
 * cuentas siguen sin cuadrar, solo se guardan si la persona lo confirma.
 */
export async function saveInvoiceReview({
  client,
  study,
  invoice,
  acceptMismatch,
  user,
  now = new Date().toISOString(),
}: {
  client: Pick<Client, "execute">;
  study: StudyRecord;
  invoice: InvoiceExtraction;
  acceptMismatch: boolean;
  user: { id: string; email: string | null };
  now?: string;
}): Promise<{ issues: InvoiceIssue[] }> {
  if (study.status === "closed") throw new StudyError("El estudio ya está completado: su factura no se puede cambiar.", 409);
  if (!study.extraction) throw new StudyError("Este estudio no tiene factura analizada.", 409);

  const previous = study.extraction as ReviewedExtraction;
  const issues = [...study.issues.filter(({ code }) => KEPT_CODES.has(code)), ...validateInvoice(invoice)];
  if (hasBlockingIssues(issues) && !acceptMismatch) {
    throw new StudyError("Las cuentas siguen sin cuadrar. Corrígelas o confirma que los datos son los de la factura.", 422);
  }

  const reviewed: ReviewedExtraction = {
    ...invoice,
    review: {
      reviewedBy: user.id,
      reviewedByEmail: user.email,
      reviewedAt: now,
      acceptedMismatch: hasBlockingIssues(issues),
      original: previous.review?.original ?? withoutReview(previous),
    },
  };
  await client.execute({
    sql: "UPDATE comparison_studies SET extraction = ?, issues = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [JSON.stringify(reviewed), JSON.stringify(issues), study.id],
  });
  return { issues };
}
