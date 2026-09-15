import { z } from "zod";
import {
  APOLO_SIPS_CUPS_REGEX,
  getApoloSipsBaseCups,
  sanitizeCups,
} from "./cups";

export const ApoloSipsProcedureSchema = z.enum(["PS", "CONSUMOS"]);

export const ApoloSipsSupplyTypeSchema = z.enum(["ELECTRICIDAD", "GAS"]);

export const ApoloSipsRequestSchema = z
  .object({
    cups: z
      .string()
      .min(1, "El CUPS es obligatorio.")
      .transform(sanitizeCups)
      .refine(
        (cups) => APOLO_SIPS_CUPS_REGEX.test(cups),
        "El CUPS no es válido.",
      )
      .transform(getApoloSipsBaseCups),
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
