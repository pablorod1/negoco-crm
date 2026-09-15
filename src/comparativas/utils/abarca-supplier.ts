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

export function getAbarcaSupplierName(payload: {
  comercializadora?: string | null;
  empresa?: string | null;
}): string | null {
  return payload.comercializadora?.trim() || payload.empresa?.trim() || null;
}

export function resolveAbarcaSupplier<T extends { id: string; name: string }>(
  name: string | null | undefined,
  suppliers: readonly T[],
): { supplier: T | null; ambiguous: boolean } {
  const normalized = normalize(name ?? "");
  if (!normalized) return { supplier: null, ambiguous: false };
  const exact = suppliers.filter((supplier) => normalize(supplier.name) === normalized);
  const company = normalized.split(" - ")[0];
  const canonical = aliases[company] ?? company;
  const candidates = exact.length ? exact : suppliers.filter((supplier) => normalize(supplier.name) === canonical);
  return { supplier: candidates.length === 1 ? candidates[0] : null, ambiguous: candidates.length > 1 };
}
