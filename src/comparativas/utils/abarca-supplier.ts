const aliases: Readonly<Record<string, string>> = {
  "NORDY RESIDENCIAL": "NORDY",
  "NORDY EMPRESA": "NORDY",
  AIRELIMPIO: "AIRE LIMPIO",
  GANA: "GANA ENERGIA",
};

function normalize(name: string): string {
  return name.normalize("NFKD").replace(/\p{M}/gu, "").trim()
    .replace(/\s+/g, " ").toLocaleUpperCase("es");
}

function compact(name: string): string {
  return normalize(name).replace(/[^\p{L}\p{N}]/gu, "");
}

export function getAbarcaSupplierName(payload: {
  comercializadora?: string | null;
  empresa?: string | null;
}): string | null {
  return payload.comercializadora?.trim() || payload.empresa?.trim() || null;
}

export interface AbarcaSupplierMapping {
  abarca_name: string;
  segment: string;
  comercializadora_id: string | null;
}

export function resolveAbarcaSupplier<T extends { id: string; name: string }>(
  name: string | null | undefined,
  suppliers: readonly T[],
  mappings: readonly AbarcaSupplierMapping[] = [],
  segment?: string | null,
): { supplier: T | null; ambiguous: boolean } {
  const normalized = normalize(name ?? "");
  if (!normalized) return { supplier: null, ambiguous: false };
  const company = normalized.split(" - ")[0];
  const eligible = mappings.filter((mapping) => !segment || mapping.segment === segment);
  const full = eligible.filter((mapping) => compact(mapping.abarca_name) === compact(normalized));
  const mapped = full.length ? full : eligible.filter((mapping) => compact(mapping.abarca_name) === compact(company));
  if (mapped.length) {
    const ids = new Set(mapped.map((mapping) => mapping.comercializadora_id));
    const id = ids.size === 1 ? mapped[0].comercializadora_id : null;
    return { supplier: id ? suppliers.find((supplier) => supplier.id === id) ?? null : null, ambiguous: ids.size > 1 };
  }
  const exact = suppliers.filter((supplier) => normalize(supplier.name) === normalized);
  const canonical = aliases[company] ?? company;
  const canonicalMatches = exact.length
    ? exact
    : suppliers.filter((supplier) => normalize(supplier.name) === canonical);
  const candidates = canonicalMatches.length
    ? canonicalMatches
    : suppliers.filter((supplier) => compact(supplier.name) === compact(canonical));
  return { supplier: candidates.length === 1 ? candidates[0] : null, ambiguous: candidates.length > 1 };
}
