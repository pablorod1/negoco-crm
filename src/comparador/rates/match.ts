import { productKeyOf } from "./names";

/** Tarifa del tenant (`comercializadora_rates`). */
export interface TenantRate {
  id: string;
  name: string;
  comercializadoraId: string;
  catalogRateId: string | null;
  enabled: boolean;
}

/** Tarifa del catálogo de la base de control (`rate_catalog`). */
export interface CatalogRate {
  id: string;
  supplierKey: string;
  supplierName: string;
  productName: string;
  productKey: string;
  pricing: string;
  accessTariffs: string;
  status: "active" | "retired";
}

export interface CatalogAlias {
  aliasKey: string;
  catalogRateId: string;
}

/**
 * - `linked`: la tarifa ya existe en el tenant.
 * - `catalog_only`: está en el catálogo pero el tenant aún no la tiene; al
 *   aprobar se crea su fila en `comercializadora_rates`.
 * - `new`: no está en el catálogo. Solo Negoco puede darla de alta.
 */
export type MatchStatus = "linked" | "catalog_only" | "new";

export interface RateMatch {
  productKey: string;
  productName: string;
  catalogRateId: string | null;
  rateId: string | null;
  status: MatchStatus;
}

/**
 * Casa cada producto del documento con el catálogo (por nombre normalizado o
 * alias) y con las tarifas del tenant (por enlace al catálogo o, si la tarifa
 * del tenant aún no está enlazada, por nombre normalizado).
 */
export function matchProducts(
  products: readonly { productKey: string; productName: string }[],
  {
    tenantRates,
    catalog,
    aliases,
  }: {
    tenantRates: readonly TenantRate[];
    catalog: readonly CatalogRate[];
    aliases: readonly CatalogAlias[];
  },
): Map<string, RateMatch> {
  const catalogByKey = new Map(
    catalog
      .filter(({ status }) => status === "active")
      .map((entry) => [entry.productKey, entry]),
  );
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  for (const alias of aliases) {
    const entry = catalogById.get(alias.catalogRateId);
    if (entry && !catalogByKey.has(alias.aliasKey)) {
      catalogByKey.set(alias.aliasKey, entry);
    }
  }

  const tenantByCatalog = new Map(
    tenantRates
      .filter(({ catalogRateId }) => catalogRateId)
      .map((rate) => [rate.catalogRateId!, rate]),
  );
  const unlinkedByName = new Map(
    tenantRates
      .filter(({ catalogRateId }) => !catalogRateId)
      .map((rate) => [productKeyOf(rate.name), rate]),
  );

  const matches = new Map<string, RateMatch>();
  for (const { productKey, productName } of products) {
    if (matches.has(productKey)) continue;
    const catalogEntry = catalogByKey.get(productKey) ?? null;
    const tenantRate = catalogEntry
      ? (tenantByCatalog.get(catalogEntry.id) ??
        unlinkedByName.get(catalogEntry.productKey) ??
        unlinkedByName.get(productKey))
      : unlinkedByName.get(productKey);

    matches.set(productKey, {
      productKey,
      productName: catalogEntry?.productName ?? productName,
      catalogRateId: catalogEntry?.id ?? tenantRate?.catalogRateId ?? null,
      rateId: tenantRate?.id ?? null,
      status: tenantRate ? "linked" : catalogEntry ? "catalog_only" : "new",
    });
  }
  return matches;
}
