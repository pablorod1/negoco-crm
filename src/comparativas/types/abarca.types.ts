import { z } from "zod";

// --- Zod Schema ---

export const AbarcaWebhookSchema = z.object({
  // Identificación
  ide: z.number(),
  crm_id: z.number(),
  comparativa_id: z.string().min(1),

  // Suministro
  cups: z.string().min(1),
  tipo_tarifa: z.string().optional(),
  potencia_contratada: z.number().optional(),
  potencia_contratada_p2: z.number().optional(),
  potencia_contratada_p3: z.number().optional(),
  potencia_contratada_p4: z.number().optional(),
  potencia_contratada_p5: z.number().optional(),
  potencia_contratada_p6: z.number().optional(),
  consumo_p1: z.number().optional(),
  consumo_p2: z.number().optional(),
  consumo_p3: z.number().optional(),
  consumo_p4: z.number().optional(),
  consumo_p5: z.number().optional(),
  consumo_p6: z.number().optional(),

  // Empresas
  empresa_cliente: z.string().optional(),
  empresa: z.string().optional(),

  // Titular
  titular: z.string().optional(),
  ape1: z.string().optional(),
  ape2: z.string().optional(),
  nombre_completo: z.string().optional(),
  dni: z.string().optional(),
  nif_empresa: z.boolean().optional(),
  autonomo: z.boolean().optional(),

  // Dirección titular
  calle: z.string().optional(),
  numero: z.string().optional(),
  codpostal: z.string().optional(),
  localidad: z.string().optional(),

  // Dirección CUPS
  calle_cups: z.string().optional(),
  numero_cups: z.string().optional(),
  localidad_cups: z.string().optional(),
  codpostal_cups: z.string().optional(),

  // Contacto
  email: z.string().optional(),
  movil: z.string().optional(),
  iban: z.string().optional(),

  // Documentos base64
  dni_photo_front: z.string().optional(),
  dni_photo_back: z.string().optional(),
  justo_titulo: z.string().optional(),
  comparativa_pdf: z.string().optional(),

  // Banderas
  cambio_titularidad: z.boolean().optional(),
  tiene_placas: z.boolean().optional(),

  // Otros
  observaciones: z.string().optional(),
  servicios: z.string().optional(),
  permanencia: z.number().optional(),
  datos_crm: z.array(z.unknown()).optional(),
});

export type AbarcaWebhookPayload = z.infer<typeof AbarcaWebhookSchema>;

// --- DB Types ---

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
  consumo_p1: number | null;
  consumo_p2: number | null;
  consumo_p3: number | null;

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
