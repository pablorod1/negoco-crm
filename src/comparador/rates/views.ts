import type { Client } from "@libsql/client";
import {
  getActiveVersion,
  getComercializadora,
  getVersionPrices,
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
  const extraction = ingest.extraction as {
    status?: string;
    reason?: string;
    extraction?: { rates?: unknown[]; commissions?: unknown[] };
    autoApproval?: { reason?: string };
  } | null;
  const read = extraction?.extraction;
  return {
    id: ingest.id,
    channel: ingest.channel,
    status: ingest.status,
    comercializadoraId: ingest.comercializadoraId,
    fileName: ingest.files[0]?.name ?? null,
    emailFrom: ingest.emailFrom,
    emailSubject: ingest.emailSubject,
    reason: extraction?.status === "out_of_scope" ? (extraction.reason ?? null) : null,
    /** Por qué no se ha aprobado sola, si se ha intentado. */
    pendingReason: ["ready", "needs_review"].includes(ingest.status) ? (extraction?.autoApproval?.reason ?? null) : null,
    /** Qué trae el anexo, si ya se ha leído: cada vista (tarifas, comisiones) enseña lo suyo. */
    contents: read
      ? { prices: (read.rates?.length ?? 0) > 0, commissions: (read.commissions?.length ?? 0) > 0 }
      : null,
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
  comercializadoraId,
  today,
}: {
  client: TenantClient;
  comercializadoraId: string;
  today: string;
}) {
  const supplier = await getComercializadora(client, comercializadoraId);
  if (!supplier) throw new RateIngestError("Comercializadora no encontrada", 404);

  const [tenantRates, activeVersion, versions, ingests, commissionRules] =
    await Promise.all([
      listTenantRates(client, supplier.id),
      getActiveVersion(client, supplier.id, today),
      listVersions(client, supplier.id),
      listIngests(client, { comercializadoraId: supplier.id, limit: 30 }),
      listCommissionRules(client, supplier.id),
    ]);
  const activePrices = activeVersion ? await getVersionPrices(client, activeVersion.id) : [];

  // Las tarifas de este tenant con precios vigentes, cada una con sus filas.
  // El catálogo es común a todos los tenants: lo que otro tenant ha dado de
  // alta (los Helsinki de Nordy que se aprobaron en test) no se enseña aquí.
  const enabledByRate = new Map(tenantRates.map((rate) => [rate.id, rate.enabled]));
  const products = new Map<string, { rateId: string; name: string; enabled: boolean; rows: typeof activePrices }>();
  for (const price of activePrices) {
    const product = products.get(price.rateId) ?? {
      rateId: price.rateId,
      name: price.rateName,
      enabled: enabledByRate.get(price.rateId) ?? true,
      rows: [],
    };
    product.rows.push(price);
    products.set(price.rateId, product);
  }
  const rates = [...products.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));

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
