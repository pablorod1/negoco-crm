import { z } from "zod";
import type { ApoloSipsPeriodValues } from "@/integrations/apolo-sips/summary";

// --- Zod Schema ---

const optionalString = z.string().nullish();
const optionalNumber = z.number().nullish();
const optionalBoolean = z.boolean().nullish();

/**
 * Los documentos NO se validan aquí a propósito.
 *
 * Cuando iban dentro del objeto, un solo fichero mal formado (un PNG en un
 * campo declarado JPEG, base64 con saltos de línea, un JPEG con bytes tras el
 * marcador EOI) tumbaba el payload entero y se perdía también el estudio. El
 * comparador acepta JPG, PNG y PDF, así que el campo por sí solo no dice qué
 * tipo llega.
 *
 * La resolución real vive en `@/comparativas/utils/abarca-documents`, que
 * decide fichero a fichero y pone en cuarentena lo que no reconoce en vez de
 * descartarlo.
 */
const documentField = z.unknown().nullish();

export const AbarcaWebhookSchema = z.object({
  // Identificación
  ide: z.number(),
  crm_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),

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

  // Documentos: base64 en línea o referencia a Storage puesta por el proxy
  dni_photo_front: documentField,
  dni_photo_back: documentField,
  justo_titulo: documentField,
  comparativa_pdf: documentField,

  // Banderas
  cambio_titularidad: optionalBoolean,
  tiene_placas: optionalBoolean,

  // Comisiones que propone Abarca, en euros.
  // Todavía NO se escriben en comparativas.comision_*: falta decidir si van al
  // slot fijo o al indexado, y la comisión del comercial se sigue calculando
  // con nuestras reglas por comercializadora. Se capturan aquí para tenerlas
  // guardadas y poder conectarlas sin volver a tocar el webhook.
  comision_oferta: optionalNumber,
  comision_base: optionalNumber,

  // Otros
  observaciones: optionalString,
  servicios: optionalString,
  permanencia: optionalNumber,
  datos_crm: z.array(z.unknown()).optional(),
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
  comisiones: AbarcaComisiones | null;

  raw_payload: string;
  created_at: string;
}

/**
 * Qué documento llegó, cuál falta y cuál no se pudo interpretar. Antes esto no
 * se registraba: una comparativa sin DNI era indistinguible de una completa.
 */
/** Comisiones propuestas por Abarca, en euros. */
export interface AbarcaComisiones {
  /** Comisión de la oferta. Equivale a `tramites.comision`. */
  oferta: number | null;
  /** Comisión del comercial según Abarca. Hoy no se aplica: la calculamos. */
  base: number | null;
}

export interface AbarcaWebhookDocument {
  field: "comparativa_pdf" | "dni_photo_front" | "dni_photo_back" | "justo_titulo";
  status: "stored" | "quarantined" | "missing" | "invalid";
  download_url: string | null;
  reason: string | null;
  size: number | null;
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
