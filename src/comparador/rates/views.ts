import type { Client } from "@libsql/client";
import { normalizeName } from "./names";
import {
  getActiveVersion,
  getComercializadora,
  getVersionPrices,
  listCatalog,
  listCommissionRules,
  listIngests,
  listLastApprovals,
  listTenantRates,
  listVersions,
  type IngestRecord,
} from "./repository";
import { freshness, medianDecisionHours } from "./staleness";
import { RateIngestError } from "./service";

type TenantClient = Pick<Client, "execute" | "batch">;

/** Ingesta resumida para listas: sin la extracción completa. */
export function summarizeIngest(ingest: IngestRecord) {
  const extraction = ingest.extraction as { status?: string; reason?: string } | null;
  return {
    id: ingest.id,
    channel: ingest.channel,
    status: ingest.status,
    comercializadoraId: ingest.comercializadoraId,
    fileName: ingest.files[0]?.name ?? null,
    emailFrom: ingest.emailFrom,
    emailSubject: ingest.emailSubject,
    reason: extraction?.status === "out_of_scope" ? (extraction.reason ?? null) : null,
    // El coste de la IA no se enseña al cliente: queda en la base y en ai_usage_events.
    error: ingest.error,
    receivedAt: ingest.receivedAt,
    processedAt: ingest.processedAt,
    decidedAt: ingest.decidedAt,
    versionId: ingest.versionId,
  };
}

/** Todo lo que enseña la vista «Tarifas» de una comercializadora. */
export async function getSupplierRatesView({
  client,
  control,
  comercializadoraId,
  today,
}: {
  client: TenantClient;
  control: Pick<Client, "execute">;
  comercializadoraId: string;
  today: string;
}) {
  const supplier = await getComercializadora(client, comercializadoraId);
  if (!supplier) throw new RateIngestError("Comercializadora no encontrada", 404);

  const [{ catalog }, tenantRates, activeVersion, versions, ingests, commissionRules] =
    await Promise.all([
      listCatalog(control, normalizeName(supplier.name)),
      listTenantRates(client, supplier.id),
      getActiveVersion(client, supplier.id, today),
      listVersions(client, supplier.id),
      listIngests(client, { comercializadoraId: supplier.id, limit: 30 }),
      listCommissionRules(client, supplier.id),
    ]);
  const activePrices = activeVersion ? await getVersionPrices(client, activeVersion.id) : [];

  const tenantByCatalog = new Map(
    tenantRates.filter((rate) => rate.catalogRateId).map((rate) => [rate.catalogRateId!, rate]),
  );
  const rowsByRate = new Map<string, number>();
  for (const price of activePrices) {
    rowsByRate.set(price.rateId, (rowsByRate.get(price.rateId) ?? 0) + 1);
  }

  // Tarifas del catálogo y del tenant en una sola lista.
  const rates = [
    ...catalog.map((entry) => {
      const tenantRate = tenantByCatalog.get(entry.id) ?? null;
      return {
        catalogRateId: entry.id,
        rateId: tenantRate?.id ?? null,
        name: entry.productName,
        pricing: entry.pricing,
        accessTariffs: entry.accessTariffs,
        catalogStatus: entry.status,
        enabled: tenantRate?.enabled ?? false,
        activeRows: tenantRate ? (rowsByRate.get(tenantRate.id) ?? 0) : 0,
      };
    }),
    ...tenantRates
      .filter((rate) => !rate.catalogRateId || !catalog.some(({ id }) => id === rate.catalogRateId))
      .filter((rate) => rowsByRate.has(rate.id))
      .map((rate) => ({
        catalogRateId: null,
        rateId: rate.id,
        name: rate.name,
        pricing: "fixed",
        accessTariffs: "2.0TD",
        catalogStatus: null,
        enabled: rate.enabled,
        activeRows: rowsByRate.get(rate.id) ?? 0,
      })),
  ];

  const lastApproval = versions.find((version) => version.approvedAt)?.approvedAt ?? null;
  return {
    supplier,
    rates,
    activeVersion,
    activePrices,
    versions,
    ingests: ingests.map(summarizeIngest),
    commissionRules,
    freshness: freshness(lastApproval),
    medianDecisionHours: medianDecisionHours(ingests),
  };
}

/** Resumen para el aviso de comercializadoras sin actualizar. */
export async function getRatesOverview(client: TenantClient) {
  const [approvals, ingests] = await Promise.all([
    listLastApprovals(client),
    listIngests(client, { limit: 200 }),
  ]);
  const pending = new Map<string, number>();
  for (const ingest of ingests) {
    if (["ready", "needs_review", "received"].includes(ingest.status)) {
      const key = ingest.comercializadoraId ?? "sin-asignar";
      pending.set(key, (pending.get(key) ?? 0) + 1);
    }
  }

  const suppliers = approvals
    .filter((supplier) => supplier.active || supplier.hasActiveVersion)
    .map((supplier) => ({
      ...supplier,
      ...freshness(supplier.lastApprovedAt),
      pendingIngests: pending.get(supplier.comercializadoraId) ?? 0,
    }));

  return {
    suppliers,
    unassignedIngests: pending.get("sin-asignar") ?? 0,
    unassigned: ingests
      .filter(
        (ingest) =>
          !ingest.comercializadoraId &&
          ["received", "ready", "needs_review", "failed", "out_of_scope"].includes(ingest.status),
      )
      .map(summarizeIngest),
    staleCount: suppliers.filter(({ status }) => status === "stale").length,
    neverCount: suppliers.filter(({ status }) => status === "never").length,
    medianDecisionHours: medianDecisionHours(ingests),
  };
}
