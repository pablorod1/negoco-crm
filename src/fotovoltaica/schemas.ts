import { z } from "zod";

// Enums aligned with current app usage
export const FotovoltaicaTypeEnum = z.enum(["PPA", "renting", "cubierta", ""], {
  message: "El tipo es obligatorio",
});

export const FotovoltaicaClientTypeEnum = z.enum(
  ["company", "public_org", "community"],
  {
    message: "El tipo de cliente es obligatorio",
  }
);

export const FotovoltaicaStatusEnum = z.enum(
  ["pending", "processing", "completed", "rejected"],
  {
    message: "El estado es obligatorio",
  }
);

// Basic URL validator (accepts http(s) URLs)
const UrlSchema = z
  .string()
  .min(1, "El enlace de la ubicación es obligatorio")
  .refine((v) => {
    try {
      // Allow plain google maps share links and general https links
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "El enlace debe ser una URL válida");

export const FotovoltaicaFileSchema = z.object({
  id: z.string().min(1),
  fotovoltaica_id: z.string().min(1),
  filename: z.string().min(1),
  size: z.number().nonnegative(),
  extension: z.string().min(0),
  upload_date: z.string().min(1),
  download_url: z.string().url(),
  preview_url: z.string().url().nullable().optional(),
});

export const FotovoltaicaSchema = z.object({
  id: z.string().min(1),
  type: FotovoltaicaTypeEnum,
  client: z.string().min(1, "El nombre del cliente es obligatorio"),
  client_type: FotovoltaicaClientTypeEnum,
  location: UrlSchema,
  coordinates: z.tuple([z.number(), z.number()]).nullable(),
  creation_date: z.string().min(1),
  activation_date: z.string().nullable(),
  status: FotovoltaicaStatusEnum,
  notes: z.array(z.string()).default([]),
  internal_notes: z.array(z.string()).default([]),
  comision: z.number().default(0),
  comision_sales_person: z.number().default(0),
  user_id: z.string().min(1),
});

export type FotovoltaicaPayload = z.infer<typeof FotovoltaicaSchema>;
export type FotovoltaicaFilePayload = z.infer<typeof FotovoltaicaFileSchema>;
