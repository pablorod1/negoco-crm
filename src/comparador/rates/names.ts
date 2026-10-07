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
 * Nombre de un producto sin la tarifa de acceso delante: Iberdrola llama
 * «2.0TD_2 Plan Estable» y «2.0TD_3 Plan Estable» al mismo producto en dos
 * tramos de potencia, y Repsol «2.0TD PRECIO FIJO…». La tarifa y el tramo ya
 * van en las condiciones; en el nombre harían dos productos de uno.
 */
export function productNameOf(raw: string): string {
  const clean = cleanName(raw);
  const stripped = clean.replace(/^(?:2[.,]?0\s?TD|2[.,]?01P)(?:\s?_\s?\d+)?\s*[-_:·]?\s*/i, "").trim();
  return stripped || clean;
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

/**
 * Clave de un producto. Como la de comercializadora, salvo el «+»: «TULUZ
 * PRO» y «TULUZ PRO+» son productos distintos (el segundo cobra margen en la
 * potencia) y no pueden compartir clave.
 */
export function productKeyOf(raw: string): string {
  return normalizeName(raw.replace(/\+/g, " plus "));
}
