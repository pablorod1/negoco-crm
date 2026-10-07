/**
 * Normalización de nombres de comercializadora y de producto. Es la misma que
 * usa el sincronizador de comercializadoras del backoffice
 * (`negoco-backoffice/src/lib/comercializadoras/normalize.ts`): los COM-xxx no
 * coinciden entre tenants, así que se casa siempre por nombre normalizado.
 */

/** Nombre listo para mostrar: sin tabuladores ni espacios de más. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Clave de comparación: sin acentos, sin signos, sin espacios y en minúsculas.
 * `"Gana Energía"`, `"gana energia"` y `"GANA-ENERGIA"` dan todos `ganaenergia`.
 */
export function normalizeName(raw: string): string {
  return cleanName(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
