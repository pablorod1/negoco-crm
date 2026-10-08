import { z } from "zod";
import { isValidSpanishTaxId } from "@/comparador/extraction/identifiers";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

/** IBAN español o europeo con su dígito de control (mod 97). */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

/**
 * Datos del cliente que se apuntan al completar el estudio. Todos opcionales:
 * el trámite exige después los que falten. Lo que se escribe, se comprueba.
 */
export const StudyClientDataSchema = z
  .object({
    name: text(120),
    lastName: text(120),
    kind: z.enum(["Particular", "Empresa"]).nullable().optional().transform((value) => value ?? null),
    documentNumber: text(20).refine((value) => value === null || isValidSpanishTaxId(value), "El DNI o CIF no es válido"),
    email: text(160).refine((value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "El correo no es válido"),
    phone: text(20).refine((value) => value === null || /^\+?[\d\s]{9,15}$/.test(value), "El teléfono no es válido"),
    iban: text(40).refine((value) => value === null || isValidIban(value), "El IBAN no es válido"),
    address: text(200),
    postalCode: text(5).refine((value) => value === null || /^\d{5}$/.test(value), "El código postal no es válido"),
    city: text(120),
    province: text(60),
  })
  .strict();

export type StudyClientData = z.output<typeof StudyClientDataSchema>;
export type StudyClientDataInput = z.input<typeof StudyClientDataSchema>;
