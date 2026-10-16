/**
 * Normalización de nombres de comercializadora y de producto. Es la misma que
 * usa el sincronizador de comercializadoras del backoffice
 * (`negoco-backoffice/src/lib/comercializadoras/normalize.ts`): los COM-xxx no
 * coinciden entre tenants, así que se casa siempre por nombre normalizado.
 */

/**
 * Un producto cuyo nombre dice que el precio sigue al mercado: OMIE, pool,
 * indexado, pass-through. También dentro de una palabra («TRADERPOOL» de
 * Eleia se guardó como fijo con solo su término B).
 */
export function looksIndexed(productName: string): boolean {
  return /omie|index|pool|pass.?through/i.test(productName);
}

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
  const stripped = clean
    .replace(/^(?:2[.,]?0\s?TD|2[.,]?01P)(?:\s?_\s?\d+)?\s*[-_:·]?\s*/i, "")
    // El código de la semana o de la versión del anexo no es del producto:
    // Eleia titula «PRODUCTO TU DECIDES S4126» y la semana siguiente «S4226».
    .replace(/\s+(?:S\d{4}|V\d{6,8})(?=\s|$)/gi, "")
    .replace(/^PRODUCTO\s+/i, "")
    .trim();
  return stripped || clean;
}

/**
 * Productos a los que se aplica una tabla de comisiones, como los titula el
 * anexo: «TARIFA ESTABLE*» es «ESTABLE»; «ESTABLE PLUS / "1P PLUS < 100MWh/año
 * (2.0TD-3.0TD)"», dos productos («ESTABLE PLUS» y «1P PLUS»: el límite de
 * consumo ya va en los tramos), y «1. Tipo de Producto Campaña:», «Campaña».
 */
export function commissionProductsOf(raw: string): string[] {
  const names = cleanName(raw)
    .split(/\s+\/\s+/)
    .map((part) =>
      part
        // «TU DECIDES ELEIA (GAS) PRECIO FIJO»: la energía y el tipo de
        // precio van en sus campos (ver `pricingInName`); en el nombre de la
        // tarifa no están.
        .replace(/\((?:gas|luz|electricidad)\)/gi, "")
        .replace(/\s+(?:precio\s+)?(?:fijo|indexado)\s*$/i, "")
        .replace(/["“”«»*]/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/\s*[<>≤≥].*$/, "")
        .replace(/^\d+\s*[.)-]\s*/, "")
        .replace(/^tipo\s+de\s+producto\s*/i, "")
        .replace(/^tarifas?\s+/i, "")
        .replace(/[:.\s]+$/, ""),
    )
    .map((part) => productNameOf(part))
    .filter(Boolean);
  return names.length ? [...new Set(names)] : [productNameOf(raw)];
}

/** «… PRECIO INDEXADO» o «… FIJO» al final del nombre de una tabla de comisiones. */
export function pricingInName(raw: string): "fixed" | "indexed" | null {
  const match = /(?:^|\s)(?:precio\s+)?(fijo|indexado)\s*$/i.exec(cleanName(raw).replace(/["“”«»*:]/g, "").trim());
  return match ? (match[1].toLowerCase() === "fijo" ? "fixed" : "indexed") : null;
}

/**
 * El producto sin el nombre de la comercializadora: Eleia titula «TU DECIDES
 * ELEIA» lo que en sus tarifas es «PRODUCTO TU DECIDES S3826 TDE 0».
 */
export function withoutSupplierName(product: string, supplierName: string): string {
  const supplier = normalizeName(supplierName);
  if (!supplier) return product;
  const kept = product.split(/\s+/).filter((word) => normalizeName(word) !== supplier);
  return kept.length ? kept.join(" ") : product;
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
