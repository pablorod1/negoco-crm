import { z } from "zod";
import type { ApoloSipsPeriodValues } from "@/integrations/apolo-sips/summary";

// --- Zod Schema ---

const optionalString = z.string().nullish();
const optionalNumber = z.number().nullish();
const optionalBoolean = z.boolean().nullish();
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_JPEG_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_DOCUMENT_BYTES = 12 * 1024 * 1024;

function isCanonicalBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    const code = value.charCodeAt(index);
    const allowed =
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0x30 && code <= 0x39) ||
      code === 0x2b ||
      code === 0x2f;
    if (!allowed) return false;
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 0x3d) return false;
  }
  return true;
}

function hasPdfMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

function hasJpegMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff &&
    buffer.at(-2) === 0xff &&
    buffer.at(-1) === 0xd9
  );
}

function documentBase64Schema(
  kind: "pdf" | "jpeg",
  maxDecodedBytes: number,
) {
  const maxEncodedLength = 4 * Math.ceil(maxDecodedBytes / 3);

  return z
    .string()
    .min(1)
    .max(maxEncodedLength)
    .superRefine((value, context) => {
      if (value.length > maxEncodedLength) return;

      if (!isCanonicalBase64(value)) {
        context.addIssue({
          code: "custom",
          message: "Invalid document encoding",
        });
        return;
      }

      const decoded = Buffer.from(value, "base64");
      if (
        decoded.length === 0 ||
        decoded.length > maxDecodedBytes ||
        decoded.toString("base64") !== value
      ) {
        context.addIssue({
          code: "custom",
          message: "Invalid document encoding",
        });
        return;
      }

      const hasExpectedMagic =
        kind === "pdf" ? hasPdfMagic(decoded) : hasJpegMagic(decoded);
      if (!hasExpectedMagic) {
        context.addIssue({
          code: "custom",
          message: "Invalid document type",
        });
      }
    })
    .nullish();
}

const pdfDocument = documentBase64Schema("pdf", MAX_PDF_BYTES);
const jpegDocument = documentBase64Schema("jpeg", MAX_JPEG_BYTES);

export const AbarcaWebhookSchema = z.object({
  // Identificación
  ide: z.number(),
  crm_id: z.number(),

  // Suministro
  cups: optionalString,
  tipo_tarifa: optionalString,
  potencia_contratada: optionalNumber,
  potencia_contratada_p2: optionalNumber,
  potencia_contratada_p3: optionalNumber,
  potencia_contratada_p4: optionalNumber,
  potencia_contratada_p5: optionalNumber,
  potencia_contratada_p6: optionalNumber,
  consumo_p1: optionalNumber,
  consumo_p2: optionalNumber,
  consumo_p3: optionalNumber,
  consumo_p4: optionalNumber,
  consumo_p5: optionalNumber,
  consumo_p6: optionalNumber,

  // Empresas
  empresa_cliente: optionalString,
  empresa: optionalString,

  // Titular
  titular: optionalString,
  ape1: optionalString,
  ape2: optionalString,
  nombre_completo: optionalString,
  dni: optionalString,
  nif_empresa: optionalBoolean,
  autonomo: optionalBoolean,

  // Dirección titular
  calle: optionalString,
  numero: optionalString,
  codpostal: optionalString,
  localidad: optionalString,

  // Dirección CUPS
  calle_cups: optionalString,
  numero_cups: optionalString,
  localidad_cups: optionalString,
  codpostal_cups: optionalString,

  // Contacto
  email: optionalString,
  movil: optionalString,
  iban: optionalString,

  // Documentos base64
  dni_photo_front: jpegDocument,
  dni_photo_back: jpegDocument,
  justo_titulo: pdfDocument,
  comparativa_pdf: pdfDocument,

  // Banderas
  cambio_titularidad: optionalBoolean,
  tiene_placas: optionalBoolean,

  // Otros
  observaciones: optionalString,
  servicios: optionalString,
  permanencia: optionalNumber,
  datos_crm: z.array(z.unknown()).optional(),
}).superRefine((payload, context) => {
  const documentValues = [
    payload.dni_photo_front,
    payload.dni_photo_back,
    payload.justo_titulo,
    payload.comparativa_pdf,
  ];
  const totalBytes = documentValues.reduce((total, value) => {
    if (typeof value !== "string" || !isCanonicalBase64(value)) {
      return total;
    }
    const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
    return total + (value.length / 4) * 3 - padding;
  }, 0);

  if (totalBytes > MAX_TOTAL_DOCUMENT_BYTES) {
    context.addIssue({
      code: "custom",
      message: "Document budget exceeded",
      path: ["comparativa_pdf"],
    });
  }
});

export type AbarcaWebhookPayload = z.infer<typeof AbarcaWebhookSchema>;

// --- DB Types ---

export interface AbarcaApoloSipsSummary {
  cups: string;
  fetched_at: string;
  months: number;
  has_data: boolean;
  max_demand_power_kw_by_period: ApoloSipsPeriodValues;
}

export interface AbarcaEstudio {
  id: string;
  comparativa_id: string;
  crm_id: number;
  ide: number;

  // Suministro
  cups: string;
  tipo_tarifa: string | null;
  potencia_contratada: number | null;
  potencia_contratada_p2: number | null;
  potencia_contratada_p3: number | null;
  potencia_contratada_p4: number | null;
  potencia_contratada_p5: number | null;
  potencia_contratada_p6: number | null;
  consumo_p1: number | null;
  consumo_p2: number | null;
  consumo_p3: number | null;
  consumo_p4: number | null;
  consumo_p5: number | null;
  consumo_p6: number | null;

  // Empresas
  empresa_cliente: string | null;
  empresa: string | null;

  // Titular
  nombre_completo: string | null;
  titular: string | null;
  ape1: string | null;
  ape2: string | null;
  dni: string | null;
  nif_empresa: boolean;
  autonomo: boolean;

  // Dirección titular
  calle: string | null;
  numero: string | null;
  codpostal: string | null;
  localidad: string | null;

  // Dirección CUPS
  calle_cups: string | null;
  numero_cups: string | null;
  codpostal_cups: string | null;
  localidad_cups: string | null;

  // Contacto
  email: string | null;
  movil: string | null;
  iban: string | null;

  // Banderas
  cambio_titularidad: boolean;
  tiene_placas: boolean;

  // Otros
  observaciones: string | null;
  servicios: string | null;
  permanencia: number;
  apolo_sips: AbarcaApoloSipsSummary | null;

  raw_payload: string;
  created_at: string;
}

export interface AbarcaSession {
  id: string;
  comparativa_id: string;
  crm_id: number;
  tenant: string;
  user_id: string;
  status: "pending" | "completed" | "expired";
  created_at: string;
}
