/**
 * Qué falta para seguir, cuando se puede arreglar en la misma pantalla:
 * `cups_missing`, la factura no trae un CUPS legible y se puede escribir a mano;
 * `other_energy`, la factura es de gas y la comparativa de luz (o al revés) y
 * se puede cambiar la comparativa.
 */
export type StudyErrorCode = "cups_missing" | "other_energy";

/** Un error que se enseña tal cual a quien hace el estudio. */
export class StudyError extends Error {
  constructor(
    message: string,
    readonly status = 422,
    readonly code?: StudyErrorCode,
  ) {
    super(message);
    this.name = "StudyError";
  }
}
