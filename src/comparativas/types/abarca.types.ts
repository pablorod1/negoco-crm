import { z } from "zod";
import type { ApoloSipsPeriodValues } from "@/integrations/apolo-sips/summary";

// --- Zod Schema ---

const optionalString = z.string().nullish();
const optionalNumber = z.number().nullish();
const optionalBoolean = z.boolean().nullish();

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
  dni_photo_front: optionalString,
  dni_photo_back: optionalString,
  justo_titulo: optionalString,
  comparativa_pdf: optionalString,

  // Banderas
  cambio_titularidad: optionalBoolean,
  tiene_placas: optionalBoolean,

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
