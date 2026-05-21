import { z } from "zod";

export const ApoloSipsProcedureSchema = z.enum(["PS", "CONSUMOS"]);

export const ApoloSipsSupplyTypeSchema = z.enum(["ELECTRICIDAD", "GAS"]);

const CUPS_REGEX = /^ES\d{16}[A-Z]{2}[A-Z0-9]{0,2}$/;

export function sanitizeCups(raw: string): string {
  return raw
    .trim()
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

export const ApoloSipsRequestSchema = z
  .object({
    cups: z
      .string()
      .min(1, "El CUPS es obligatorio.")
      .transform(sanitizeCups)
      .refine((cups) => CUPS_REGEX.test(cups), "El CUPS no es válido."),
    tipoSuministro: ApoloSipsSupplyTypeSchema,
    procedimientos: z
      .array(ApoloSipsProcedureSchema)
      .min(1, "Debes indicar al menos un procedimiento.")
      .max(2, "Solo se permiten PS y CONSUMOS.")
      .refine(
        (procedures) => new Set(procedures).size === procedures.length,
        "No se permiten procedimientos duplicados.",
      ),
  })
  .strict();
