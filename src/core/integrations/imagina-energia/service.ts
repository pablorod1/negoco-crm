import { isDeepStrictEqual } from "node:util";
import type { Client } from "@libsql/client";
import { readImaginaEnergiaConfig } from "./config";
import { ImaginaEnergiaClient } from "./client";
import {
  documentTypeForImaginaUpload,
  listImaginaRequiredFields,
  validateAndBuildImaginaContractPayload,
} from "./mappers";
import type { ImaginaValidationError } from "./mappers";
import {
  ImaginaAsyncAcceptedSchema,
  ImaginaContractCallbackSchema,
  ImaginaContractCallback,
  ImaginaContractChangeWebhook,
  ImaginaContractDetailResponseSchema,
  ImaginaContractInfo,
  ImaginaContractListResponseSchema,
  ImaginaScoringCallback,
  ImaginaScoringRequest,
  ImaginaTarifa,
  ImaginaTarifasResponseSchema,
} from "./schemas";
import {
  findContractByIntegrationRef,
  findContractBySignatureCircuit,
  findSubmissionByCorrelation,
  getContractIntegrationRef,
  getImaginaComercializadora,
  getImaginaIntegration,
  getSelectedImaginaRate,
  getSubmissionBundle,
  insertContractSubmission,
  markTramiteSentToSupplier,
  persistContractSnapshot,
  upsertContractIntegrationRef,
  updateCrmStatusFromImagina,
} from "./persistence";
import type { ContractIntegrationRef } from "./persistence";
import {
  mapContractCallbackToNegoco,
  mapContractInfoToNegoco,
  mapChangeWebhookToNegoco,
  mapScoringCodeToNegoco,
} from "./state-mapper";
import type { ImaginaStatusMapping } from "./state-mapper";
import { IMAGINA_PROVIDER } from "./config";
import { SENT_TO_SUPPLIER_STATUS } from "@/tramites/constants/tramite.constants";

interface ServiceContext {
  db: Client;
  tenant: string;
  client?: ImaginaEnergiaClient;
}

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  missing?: unknown;
  status?: number;
}

interface ImaginaPreflightResult {
  endpoint: string;
  referenciaExterna: string;
}

const getClient = (context: ServiceContext): ImaginaEnergiaClient =>
  context.client || new ImaginaEnergiaClient();

const requireChannel = async (db: Client): Promise<string> => {
  const integration = await getImaginaIntegration(db);
  if (!integration.enabled || !integration.configured || !integration.channelId) {
    throw new Error("La integración de Imagina Energia no está configurada");
  }
  return integration.channelId;
};

const numberFromUnknown = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const firstNumericTariffPrice = (tariff: ImaginaTarifa): number => {
  for (const key of [
    "energia_p1_formula",
    "energia_p2_formula",
    "energia_p3_formula",
    "energia_p4_formula",
    "energia_p5_formula",
    "energia_p6_formula",
    "potencia_p1_formula",
  ]) {
    const value = numberFromUnknown((tariff as Record<string, unknown>)[key]);
    if (value !== null) return value;
  }
  return 0;
};

export const getImaginaIntegrationStatus = async (
  db: Client,
  params?: { contractId?: string | null },
): Promise<{
  enabled: boolean;
  configured: boolean;
  submission: ContractIntegrationRef | null;
}> => {
  const integration = await getImaginaIntegration(db);
  const submission =
    integration.configured && params?.contractId
      ? await getContractIntegrationRef(db, IMAGINA_PROVIDER, params.contractId)
      : null;
  let resolvedSubmission = submission;

  // Compatibilidad con callbacks recibidos antes de guardar el resultado
  // normalizado: se deriva al consultar, sin modificar datos desde este GET.
  if (submission && !submission.outcome_code && params?.contractId) {
    const latest = await db.execute({
      sql: `SELECT response FROM imagina_contract_submissions
            WHERE contract_id = ? AND response IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 1`,
      args: [params.contractId],
    });
    const rawResponse = latest.rows[0]?.response;
    if (typeof rawResponse === "string") {
      try {
        const parsed = ImaginaContractCallbackSchema.safeParse(
          JSON.parse(rawResponse),
        );
        if (parsed.success) {
          const outcome = mapContractCallbackToNegoco(parsed.data);
          resolvedSubmission = {
            ...submission,
            outcome_code: outcome.code,
            outcome_phase: outcome.phase,
            outcome_message: outcome.message,
            recovery_action: outcome.recoveryAction,
            outcome_terminal: outcome.terminal,
            circuito_id:
              submission.circuito_id ||
              (parsed.data.firma_result?.circuito_id == null
                ? null
                : String(parsed.data.firma_result.circuito_id)),
          };
        }
      } catch {
        // La respuesta histórica se conserva en bruto aunque no sea JSON válido.
      }
    }
  }
  return {
    enabled: integration.enabled,
    configured: integration.configured,
    submission: resolvedSubmission,
  };
};

export const syncImaginaTarifas = async (
  context: ServiceContext,
): Promise<ServiceResult<{ count: number; added: number; updated: number; deactivated: number; requestId?: string | number }>> => {
  const channelId = await requireChannel(context.db);
  const supplier = await getImaginaComercializadora(context.db);
  if (!supplier) {
    return {
      success: false,
      status: 422,
      error:
        "No existe una comercializadora activa con nombre Imagina Energía en este tenant",
    };
  }

  const response = await getClient(context).request<unknown>({
    method: "GET",
    path: "/tarifas",
    channelId,
  });
  const parsed = ImaginaTarifasResponseSchema.parse(response.data);
  const now = new Date().toISOString();

  const ids = new Set(parsed.content.map((tariff) => String(tariff.id_tarifa_precios)));
  if (ids.size !== parsed.content.length) throw new Error("Imagina ha devuelto identificadores de tarifa duplicados");
  const upserts = parsed.content.map((tariff) => {
    const externalRateId = String(tariff.id_tarifa_precios);
    return {
      sql: `INSERT INTO comercializadora_rates (
              id, name, price, type, created_at, updated_at, comercializadora_id,
              provider, external_rate_id, alias_externo, codigo_atr, descripcion,
              raw, synced_at, enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(comercializadora_id, provider, external_rate_id)
            DO UPDATE SET
              name = excluded.name,
              price = excluded.price,
              type = excluded.type,
              updated_at = excluded.updated_at,
              alias_externo = excluded.alias_externo,
              codigo_atr = excluded.codigo_atr,
              descripcion = excluded.descripcion,
              raw = excluded.raw,
              synced_at = excluded.synced_at,
              enabled = 1`,
      args: [
        crypto.randomUUID(),
        tariff.alias_externo || tariff.nombre || externalRateId,
        firstNumericTariffPrice(tariff),
        tariff.tipo_tarifa_precio || null,
        now,
        now,
        String(supplier.id),
        IMAGINA_PROVIDER,
        externalRateId,
        tariff.alias_externo || null,
        tariff.codigo_atr || null,
        tariff.descripcion || null,
        JSON.stringify(tariff),
        now,
      ],
    };
  });

  const transaction = await context.db.transaction("write");
  let added = 0;
  let updated = 0;
  let deactivated = 0;
  try {
    const previous = await transaction.execute({
      sql: "SELECT external_rate_id, raw, enabled FROM comercializadora_rates WHERE comercializadora_id = ? AND provider = ?",
      args: [String(supplier.id), IMAGINA_PROVIDER],
    });
    const byId = new Map(previous.rows.map((row) => [String(row.external_rate_id), row]));
    for (const tariff of parsed.content) {
      const before = byId.get(String(tariff.id_tarifa_precios));
      if (!before) added++;
      else if (!before.enabled || !isDeepStrictEqual(JSON.parse(String(before.raw || "null")), tariff)) updated++;
    }
    deactivated = previous.rows.filter((row) => Boolean(row.enabled) && !ids.has(String(row.external_rate_id))).length;
    // Retain IDs for existing contracts, and publish the entire catalogue atomically.
    await transaction.batch([
      { sql: "UPDATE comercializadora_rates SET enabled = 0 WHERE comercializadora_id = ? AND provider = ?", args: [String(supplier.id), IMAGINA_PROVIDER] },
      ...upserts,
    ]);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }

  return {
    success: true,
    data: {
      count: parsed.content.length,
      added, updated, deactivated,
      requestId: parsed.request_id,
    },
  };
};

export const submitImaginaContract = async (
  context: ServiceContext,
  params: { tramiteId: string; contractId?: string | null; userId?: string | null },
): Promise<
  ServiceResult<{
    requestId?: string | number;
    referenciaExterna: string;
    status: string | null;
  }>
> => {
  const channelId = await requireChannel(context.db);
  const bundle = await getSubmissionBundle(
    context.db,
    params.tramiteId,
    params.contractId,
  );

  if (!bundle) {
    return {
      success: false,
      status: 404,
      error: "No se ha encontrado el trámite, contrato, cliente o firmante",
    };
  }

  // Un external_contract_id solo existe cuando Imagina confirmó la creación:
  // reenviar crearía un contrato duplicado en su lado.
  const existingRef = await getContractIntegrationRef(
    context.db,
    IMAGINA_PROVIDER,
    bundle.contract.id,
  );
  if (existingRef?.external_contract_id) {
    return {
      success: false,
      status: 409,
      error: `Este contrato ya existe en Imagina Energía (id ${existingRef.external_contract_id}); no se puede enviar de nuevo.`,
    };
  }

  const config = readImaginaEnergiaConfig();
  const built = validateAndBuildImaginaContractPayload({
    tenant: context.tenant,
    webhookRootDomain: config.webhookPublicRootDomain,
    tramite: bundle.tramite,
    client: bundle.client,
    contract: bundle.contract,
    signer: bundle.signer,
    rate: bundle.rate,
  });

  if (!built.ok) {
    return {
      success: false,
      status: 422,
      error: built.error,
      missing: built.missing,
    };
  }

  const response = await getClient(context).request<unknown>({
    method: "POST",
    path: built.endpoint,
    channelId,
    json: built.payload,
  });
  const parsed = ImaginaAsyncAcceptedSchema.parse(response.data);

  await insertContractSubmission(context.db, {
    tramiteId: bundle.tramite.id,
    contractId: bundle.contract.id,
    referenciaExterna: built.referenciaExterna,
    endpoint: built.endpoint,
    payload: built.payload,
    requestId: parsed.request_id,
    response: parsed,
    status: "accepted",
  });

  await upsertContractIntegrationRef(context.db, {
    provider: IMAGINA_PROVIDER,
    tramiteId: bundle.tramite.id,
    contractId: bundle.contract.id,
    externalReference: built.referenciaExterna,
    requestId: parsed.request_id,
    syncedAt: new Date().toISOString(),
  });

  const sent = await markTramiteSentToSupplier(context.db, {
    tramiteId: bundle.tramite.id,
    userId: params.userId ?? null,
    description: `Contrato enviado a Imagina Energía (ref. ${built.referenciaExterna})`,
  });

  return {
    success: true,
    data: {
      requestId: parsed.request_id,
      referenciaExterna: built.referenciaExterna,
      status: sent.updated ? SENT_TO_SUPPLIER_STATUS : null,
    },
  };
};

export const preflightImaginaContract = async (
  context: ServiceContext,
  params: { tramiteId: string; contractId?: string | null },
): Promise<ServiceResult<ImaginaPreflightResult>> => {
  await requireChannel(context.db);
  const bundle = await getSubmissionBundle(
    context.db,
    params.tramiteId,
    params.contractId,
  );

  if (!bundle) {
    return {
      success: false,
      status: 404,
      error: "No se ha encontrado el trámite, contrato, cliente o firmante",
    };
  }

  const config = readImaginaEnergiaConfig();
  const built = validateAndBuildImaginaContractPayload({
    tenant: context.tenant,
    webhookRootDomain: config.webhookPublicRootDomain,
    tramite: bundle.tramite,
    client: bundle.client,
    contract: bundle.contract,
    signer: bundle.signer,
    rate: bundle.rate,
  });

  if (!built.ok) {
    return {
      success: false,
      status: 422,
      error: built.error,
      missing: built.missing,
    };
  }

  return {
    success: true,
    data: {
      endpoint: built.endpoint,
      referenciaExterna: built.referenciaExterna,
    },
  };
};

export interface ImaginaContractReadiness {
  configured: boolean;
  required: string[];
  missing: ImaginaValidationError[];
}

// Igual que el preflight, pero pensado para pintar progreso: no lanza si la
// integración no está configurada y devuelve también los campos requeridos.
export const getImaginaContractReadiness = async (
  context: ServiceContext,
  params: { tramiteId: string; contractId?: string | null },
): Promise<ServiceResult<ImaginaContractReadiness>> => {
  const integration = await getImaginaIntegration(context.db);
  if (!integration.configured) {
    return {
      success: true,
      data: { configured: false, required: [], missing: [] },
    };
  }

  const bundle = await getSubmissionBundle(
    context.db,
    params.tramiteId,
    params.contractId,
  );
  if (!bundle) {
    return {
      success: false,
      status: 404,
      error: "No se ha encontrado el trámite, contrato, cliente o firmante",
    };
  }

  const config = readImaginaEnergiaConfig();
  const built = validateAndBuildImaginaContractPayload({
    tenant: context.tenant,
    webhookRootDomain: config.webhookPublicRootDomain,
    tramite: bundle.tramite,
    client: bundle.client,
    contract: bundle.contract,
    signer: bundle.signer,
    rate: bundle.rate,
  });

  return {
    success: true,
    data: {
      configured: true,
      required: listImaginaRequiredFields(bundle.client),
      missing: built.ok ? [] : built.missing,
    },
  };
};

export const preflightImaginaContractDraft = async (
  context: ServiceContext,
  input: {
    tramite: Parameters<typeof validateAndBuildImaginaContractPayload>[0]["tramite"];
    client: Parameters<typeof validateAndBuildImaginaContractPayload>[0]["client"];
    contract: Parameters<typeof validateAndBuildImaginaContractPayload>[0]["contract"];
    signer?: Parameters<typeof validateAndBuildImaginaContractPayload>[0]["signer"];
  },
): Promise<ServiceResult<ImaginaPreflightResult>> => {
  await requireChannel(context.db);
  const config = readImaginaEnergiaConfig();
  const rate = await getSelectedImaginaRate(context.db, input.contract);
  const built = validateAndBuildImaginaContractPayload({
    tenant: context.tenant,
    webhookRootDomain: config.webhookPublicRootDomain,
    tramite: input.tramite,
    client: input.client,
    contract: input.contract,
    signer: input.signer,
    rate,
  });

  if (!built.ok) {
    return {
      success: false,
      status: 422,
      error: built.error,
      missing: built.missing,
    };
  }

  return {
    success: true,
    data: {
      endpoint: built.endpoint,
      referenciaExterna: built.referenciaExterna,
    },
  };
};

const endpointForScoring = (request: ImaginaScoringRequest): string => {
  if (request.product === "gas" && request.mode === "no_sips") {
    return "/creditcheck_no_sips_gas";
  }
  if (request.product === "gas") return "/creditcheck_gas";
  if (request.mode === "no_sips") return "/creditcheck_no_sips";
  return "/creditcheck";
};

export const requestImaginaScoring = async (
  context: ServiceContext,
  request: ImaginaScoringRequest,
): Promise<ServiceResult<{ requestId?: string | number; endpoint: string }>> => {
  const channelId = await requireChannel(context.db);
  const config = readImaginaEnergiaConfig();
  const endpoint = endpointForScoring(request);
  const referenciaExterna =
    request.referencia_externa ||
    `NEG-SCORING-${context.tenant}-${Date.now()}`;
  const payload = {
    ...request,
    referencia_externa: referenciaExterna,
    callback_url: `https://${context.tenant}.${config.webhookPublicRootDomain}/api/webhooks/imagina-energia/scoring`,
  };
  delete (payload as Record<string, unknown>).product;
  delete (payload as Record<string, unknown>).mode;
  delete (payload as Record<string, unknown>).tramite_id;
  delete (payload as Record<string, unknown>).contract_id;

  const response = await getClient(context).request<unknown>({
    method: "POST",
    path: endpoint,
    channelId,
    json: payload,
  });
  const accepted = ImaginaAsyncAcceptedSchema.safeParse(response.data);
  const requestId = accepted.success ? accepted.data.request_id : response.requestId;

  await context.db.execute({
    sql: `INSERT INTO imagina_scoring_requests (
            id, tramite_id, contract_id, endpoint, product, mode, referencia_externa, request_id,
            payload, result, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    args: [
      crypto.randomUUID(),
      request.tramite_id || null,
      request.contract_id || null,
      endpoint,
      request.product,
      request.mode,
      referenciaExterna,
      requestId == null ? null : String(requestId),
      JSON.stringify(payload),
      JSON.stringify(response.data),
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  });

  return { success: true, data: { requestId, endpoint } };
};

export const sendImaginaSignature = async (
  context: ServiceContext,
  payload: {
    contrato_id: number;
    canal_envio: "sms" | "email" | "email_otp";
    direcciones_firma: string;
    referencia_externa?: string;
  },
): Promise<ServiceResult<unknown>> => {
  const channelId = await requireChannel(context.db);
  const response = await getClient(context).request<unknown>({
    method: "POST",
    path: "/firma",
    channelId,
    json: payload,
  });
  const [circuitoId, localContract] = await Promise.all([
    persistSignatureOperation(context.db, "send", payload, response.data),
    findContractByIntegrationRef(context.db, IMAGINA_PROVIDER, {
      externalContractId: payload.contrato_id,
    }),
  ]);
  if (localContract) {
    const outcome = signatureSentOutcome();
    await upsertContractIntegrationRef(context.db, {
      provider: IMAGINA_PROVIDER,
      tramiteId: localContract.tramite_id,
      contractId: localContract.id,
      circuitoId,
      syncedAt: new Date().toISOString(),
      outcome,
    });
    await updateCrmStatusFromImagina(
      context.db,
      localContract.tramite_id,
      outcome.status,
      outcome.reason,
    );
  }
  return { success: true, data: response.data };
};

export const resendImaginaSignature = async (
  context: ServiceContext,
  payload: {
    circuito_id: string;
    mode?: "ds" | "os" | "ud";
    referencia_externa?: string;
  },
): Promise<ServiceResult<unknown>> => {
  const channelId = await requireChannel(context.db);
  const response = await getClient(context).request<unknown>({
    method: "POST",
    path: "/firma/reenviar",
    channelId,
    json: payload,
  });
  const [circuitoId, localContract] = await Promise.all([
    persistSignatureOperation(context.db, "resend", payload, response.data),
    findContractBySignatureCircuit(
      context.db,
      IMAGINA_PROVIDER,
      payload.circuito_id,
    ),
  ]);
  if (localContract) {
    const outcome = signatureSentOutcome("Firma reenviada correctamente.");
    await upsertContractIntegrationRef(context.db, {
      provider: IMAGINA_PROVIDER,
      tramiteId: localContract.tramite_id,
      contractId: localContract.id,
      circuitoId: circuitoId || payload.circuito_id,
      syncedAt: new Date().toISOString(),
      outcome,
    });
    await updateCrmStatusFromImagina(
      context.db,
      localContract.tramite_id,
      outcome.status,
      outcome.reason,
    );
  }
  return { success: true, data: response.data };
};

export const getImaginaSignatureStatus = async (
  context: ServiceContext,
  circuitoId: string,
  referenciaExterna?: string,
): Promise<ServiceResult<unknown>> => {
  const channelId = await requireChannel(context.db);
  const response = await getClient(context).request<unknown>({
    method: "GET",
    path: `/firma/${encodeURIComponent(circuitoId)}`,
    channelId,
    query: { referencia_externa: referenciaExterna },
  });
  return { success: true, data: response.data };
};

export const getImaginaSignatureHealth = async (
  context: ServiceContext,
): Promise<ServiceResult<unknown>> => {
  const response = await getClient(context).request<unknown>({
    method: "GET",
    path: "/firma-health",
    auth: false,
    requireChannel: false,
  });
  return { success: true, data: response.data };
};

const signatureSentOutcome = (
  message = "La firma se ha enviado correctamente al cliente.",
): ImaginaStatusMapping => ({
  status: "Pendiente de Firma",
  reason: "Firma enviada desde Negoco a través de Imagina",
  terminal: false,
  code: "SIGNATURE_SENT",
  phase: "signature",
  message,
  recoveryAction: "sync",
});

const persistSignatureOperation = async (
  db: Client,
  operation: string,
  payload: Record<string, unknown>,
  result: unknown,
): Promise<string | null> => {
  const resultObject = result && typeof result === "object" ? result : {};
  const requestId = (resultObject as { request_id?: unknown }).request_id;
  const firmaResult = (resultObject as { firma_result?: unknown }).firma_result;
  const circuitoId =
    firmaResult && typeof firmaResult === "object"
      ? (firmaResult as { circuito_id?: unknown }).circuito_id
      : payload.circuito_id;

  await db.execute({
    sql: `INSERT INTO imagina_signature_requests (
            id, imagina_contract_id, request_id, circuito_id, operation,
            canal_envio, referencia_externa, payload, result, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?)`,
    args: [
      crypto.randomUUID(),
      String(payload.contrato_id || ""),
      requestId == null ? null : String(requestId),
      circuitoId == null ? null : String(circuitoId),
      operation,
      typeof payload.canal_envio === "string" ? payload.canal_envio : null,
      typeof payload.referencia_externa === "string"
        ? payload.referencia_externa
        : null,
      JSON.stringify(payload),
      JSON.stringify(result),
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  });
  return circuitoId == null ? null : String(circuitoId);
};

export const syncImaginaContractsDump = async (
  context: ServiceContext,
  options: { perPage?: number } = {},
): Promise<ServiceResult<{ count: number; pages: number }>> => {
  const channelId = await requireChannel(context.db);
  const perPage = options.perPage || 500;
  let page = 1;
  let count = 0;

  while (true) {
    const response = await getClient(context).request<unknown>({
      method: "GET",
      path: "/contratos",
      channelId,
      query: { pagina: page, por_pagina: perPage },
    });
    const parsed = ImaginaContractListResponseSchema.parse(response.data);
    for (const contract of parsed.contratos) {
      await persistImaginaContractInfo(context.db, contract, {
        source: "dump",
        requestId: parsed.request_id,
      });
    }
    count += parsed.contratos.length;
    if (parsed.num_contratos < perPage || parsed.contratos.length === 0) break;
    page += 1;
  }

  return { success: true, data: { count, pages: page } };
};

export const getAndReconcileImaginaContract = async (
  context: ServiceContext,
  imaginaContractId: string | number,
): Promise<ServiceResult<ImaginaContractInfo>> => {
  const channelId = await requireChannel(context.db);
  const response = await getClient(context).request<unknown>({
    method: "GET",
    path: `/contrato/${encodeURIComponent(String(imaginaContractId))}`,
    channelId,
  });
  const parsed = ImaginaContractDetailResponseSchema.parse(response.data);
  await persistImaginaContractInfo(context.db, parsed.contrato, {
    source: "detail",
    requestId: parsed.request_id,
    applyStatus: true,
  });
  return { success: true, data: parsed.contrato };
};

const persistImaginaContractInfo = async (
  db: Client,
  contract: ImaginaContractInfo,
  options: {
    source: string;
    requestId?: string | number | null;
    applyStatus?: boolean;
  },
): Promise<void> => {
  const imaginaId = String(contract.id);
  const localContract = await findContractByIntegrationRef(db, IMAGINA_PROVIDER, {
    externalContractId: imaginaId,
    externalContractCode: contract.codigo || null,
  });
  const mapping = mapContractInfoToNegoco(contract);

  await persistContractSnapshot(db, {
    contractId: localContract?.id || null,
    tramiteId: localContract?.tramite_id || null,
    imaginaContractId: imaginaId,
    imaginaContractCode: contract.codigo || null,
    externalReference: contract.alias_externo || null,
    estadoId: contract.estado?.id ?? null,
    estadoDescripcion: contract.estado?.descripcion ?? contract.estado?.estado,
    subestadoId: contract.subestado?.id ?? null,
    subestadoDescripcion:
      contract.subestado?.descripcion ?? contract.subestado?.subestado,
    raw: contract,
    source: options.source,
    requestId: options.requestId,
  });

  if (localContract) {
    await upsertContractIntegrationRef(db, {
      provider: IMAGINA_PROVIDER,
      tramiteId: localContract.tramite_id,
      contractId: localContract.id,
      externalContractId: imaginaId,
      externalContractCode: contract.codigo || null,
      externalReference: contract.alias_externo || null,
      status: contract.estado?.descripcion || contract.estado?.estado || null,
      substatus:
        contract.subestado?.descripcion || contract.subestado?.subestado || null,
      syncedAt: new Date().toISOString(),
      outcome: mapping,
    });

    if (options.applyStatus) {
      await updateCrmStatusFromImagina(
        db,
        localContract.tramite_id,
        mapping.status,
        mapping.reason,
      );
    }
  }
};

export const processImaginaContractCallback = async (
  context: ServiceContext,
  callback: ImaginaContractCallback,
): Promise<ServiceResult<{ duplicate: boolean }>> => {
  const submission = await findSubmissionByCorrelation(context.db, {
    requestId: callback.request_id,
    referenciaExterna: callback.referencia_externa,
  });

  if (!submission) {
    return {
      success: false,
      status: 404,
      error: "No local submission found for Imagina callback",
    };
  }

  const content = callback.contrato_result?.content;
  const mapping = mapContractCallbackToNegoco(callback);

  if (content?.id) {
    const supplyPoint = (
      content as ImaginaContractInfo & {
        punto_suministro?: { cups?: unknown };
      }
    ).punto_suministro;

    await upsertContractIntegrationRef(context.db, {
      provider: IMAGINA_PROVIDER,
      tramiteId: String(submission.tramite_id),
      contractId: String(submission.contract_id),
      externalContractId: content.id,
      externalContractCode: content.codigo || null,
      externalReference: callback.referencia_externa || null,
      requestId: callback.request_id,
      status: content.estado?.descripcion || content.estado?.estado || null,
      substatus:
        content.subestado?.descripcion || content.subestado?.subestado || null,
      syncedAt: new Date().toISOString(),
      outcome: mapping,
      circuitoId: callback.firma_result?.circuito_id ?? null,
    });

    await persistContractSnapshot(context.db, {
      contractId: String(submission.contract_id),
      tramiteId: String(submission.tramite_id),
      imaginaContractId: String(content.id),
      imaginaContractCode: content.codigo || null,
      externalReference: callback.referencia_externa || null,
      estadoId: content.estado?.id ?? null,
      estadoDescripcion: content.estado?.descripcion ?? content.estado?.estado,
      subestadoId: content.subestado?.id ?? null,
      subestadoDescripcion:
        content.subestado?.descripcion ?? content.subestado?.subestado,
      raw: callback,
      source: "contratacion_callback",
      requestId: callback.request_id,
    });

    await uploadLocalDocumentsForCreatedContract(context, {
      tramiteId: String(submission.tramite_id),
      contractId: String(submission.contract_id),
      imaginaContractId: String(content.id),
      cups: supplyPoint?.cups ? String(supplyPoint.cups) : null,
    });
  } else {
    await upsertContractIntegrationRef(context.db, {
      provider: IMAGINA_PROVIDER,
      tramiteId: String(submission.tramite_id),
      contractId: String(submission.contract_id),
      externalReference: callback.referencia_externa || null,
      requestId: callback.request_id,
      syncedAt: new Date().toISOString(),
      outcome: mapping,
      circuitoId: callback.firma_result?.circuito_id ?? null,
    });
  }

  await context.db.execute({
    sql: `UPDATE imagina_contract_submissions
          SET response = ?, status = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      JSON.stringify(callback),
      callback.error ? "error" : "callback_received",
      new Date().toISOString(),
      String(submission.id),
    ],
  });

  await updateCrmStatusFromImagina(
    context.db,
    String(submission.tramite_id),
    mapping.status,
    mapping.reason,
  );

  return { success: true, data: { duplicate: false } };
};

export const processImaginaContractChangeWebhook = async (
  context: ServiceContext,
  webhook: ImaginaContractChangeWebhook,
): Promise<ServiceResult<{ status: string | null }>> => {
  const imaginaContractId = webhook.contrato?.id;
  const imaginaContractCode = webhook.contrato?.codigo;

  if (imaginaContractId == null && !imaginaContractCode) {
    return {
      success: false,
      status: 422,
      error: "Webhook de contrato sin identificador de contrato Imagina",
    };
  }

  const localContract = await findContractByIntegrationRef(
    context.db,
    IMAGINA_PROVIDER,
    {
      externalContractId: imaginaContractId == null ? null : imaginaContractId,
      externalContractCode: imaginaContractCode || null,
    },
  );

  if (!localContract) {
    return {
      success: false,
      status: 404,
      error: "No local contract found for Imagina change webhook",
    };
  }

  const mapping = mapChangeWebhookToNegoco(webhook);
  const estadoChange = webhook.cambios?.find(
    (change) =>
      change.campo?.toLowerCase() === "estado" ||
      change.campo_tecnico?.toLowerCase() === "id_estado",
  );
  const subestadoChange = webhook.cambios?.find(
    (change) =>
      change.campo?.toLowerCase() === "subestado" ||
      change.campo_tecnico?.toLowerCase() === "id_subestado",
  );

  await upsertContractIntegrationRef(context.db, {
    provider: IMAGINA_PROVIDER,
    tramiteId: localContract.tramite_id,
    contractId: localContract.id,
    externalContractId: imaginaContractId == null ? null : imaginaContractId,
    externalContractCode: imaginaContractCode || null,
    status: estadoChange?.descripcion_nueva || null,
    substatus: subestadoChange?.descripcion_nueva || null,
    syncedAt: new Date().toISOString(),
    outcome: mapping,
  });

  await persistContractSnapshot(context.db, {
    contractId: localContract.id,
    tramiteId: localContract.tramite_id,
    imaginaContractId: String(imaginaContractId || imaginaContractCode),
    imaginaContractCode: imaginaContractCode || null,
    estadoId:
      typeof estadoChange?.valor_nuevo === "number"
        ? estadoChange.valor_nuevo
        : null,
    estadoDescripcion: estadoChange?.descripcion_nueva || null,
    subestadoId:
      typeof subestadoChange?.valor_nuevo === "number"
        ? subestadoChange.valor_nuevo
        : null,
    subestadoDescripcion: subestadoChange?.descripcion_nueva || null,
    raw: webhook,
    source: "contract_change_webhook",
    requestId: webhook._metadata?.notification_id ?? null,
  });

  await updateCrmStatusFromImagina(
    context.db,
    localContract.tramite_id,
    mapping.status,
    mapping.reason,
  );

  return { success: true, data: { status: mapping.status } };
};

export const processImaginaScoringCallback = async (
  context: ServiceContext,
  callback: ImaginaScoringCallback,
): Promise<ServiceResult<{ status: string | null }>> => {
  const callbackError =
    typeof callback.error === "string"
      ? callback.error
      : callback.error && typeof callback.error === "object"
        ? String(
            (callback.error as { message?: unknown; error?: unknown }).message ||
              (callback.error as { error?: unknown }).error ||
              "Error de scoring comunicado por Imagina",
          )
        : undefined;
  const scoringDetail =
    callback.result?.error || callback.result?.texto || callbackError;
  const mapping = mapScoringCodeToNegoco(
    callback.result?.codigo,
    scoringDetail,
  );
  await context.db.execute({
    sql: `UPDATE imagina_scoring_requests
          SET result = ?, status = ?, updated_at = ?
          WHERE request_id = ? OR referencia_externa = ?`,
    args: [
      JSON.stringify(callback),
      callback.error ? "error" : "completed",
      new Date().toISOString(),
      String(callback.request_id),
      callback.referencia_externa || "",
    ],
  });

  const local = await context.db.execute({
    sql: `SELECT tramite_id, contract_id FROM imagina_scoring_requests
          WHERE request_id = ? OR referencia_externa = ?
          ORDER BY created_at DESC
          LIMIT 1`,
    args: [String(callback.request_id), callback.referencia_externa || ""],
  });

  if (local.rows[0]?.tramite_id) {
    if (local.rows[0].contract_id) {
      await upsertContractIntegrationRef(context.db, {
        provider: IMAGINA_PROVIDER,
        tramiteId: String(local.rows[0].tramite_id),
        contractId: String(local.rows[0].contract_id),
        externalReference: callback.referencia_externa || null,
        requestId: callback.request_id,
        syncedAt: new Date().toISOString(),
        outcome: mapping,
      });
    }
    await updateCrmStatusFromImagina(
      context.db,
      String(local.rows[0].tramite_id),
      mapping.status,
      mapping.reason,
    );
  }

  return { success: true, data: { status: mapping.status } };
};

export const uploadImaginaDocument = async (
  context: ServiceContext,
  params: {
    imaginaContractId: string | number;
    file: Blob;
    filename: string;
    tipoFichero: string;
    cups?: string | null;
    fechaFirma?: string | null;
    fechaDocumento?: string | null;
  },
): Promise<ServiceResult<unknown>> => {
  const channelId = await requireChannel(context.db);
  const formData = new FormData();
  formData.set("id_contrato", String(params.imaginaContractId));
  formData.set("fichero", params.file, params.filename);
  formData.set("tipo_fichero", params.tipoFichero);
  if (params.cups) formData.set("cups", params.cups);
  if (params.fechaFirma) formData.set("fecha_firma", params.fechaFirma);
  if (params.fechaDocumento) {
    formData.set("fecha_documento", params.fechaDocumento);
  }

  const response = await getClient(context).request<unknown>({
    method: "POST",
    path: "/documento",
    channelId,
    formData,
  });

  return { success: true, data: response.data };
};

export const uploadLocalDocumentsForCreatedContract = async (
  context: ServiceContext,
  params: {
    tramiteId: string;
    contractId: string;
    imaginaContractId: string | number;
    cups?: string | null;
  },
): Promise<void> => {
  const files = await context.db.execute({
    sql: `SELECT * FROM tramite_files WHERE tramite_id = ?`,
    args: [params.tramiteId],
  });

  for (const file of files.rows) {
    const downloadUrl = String(file.download_url || "");
    if (!downloadUrl) continue;

    const filename = String(file.filename || "documento");
    const extension = String(file.extension || "").toLowerCase();
    const tipoFichero = documentTypeForImaginaUpload(extension, filename);
    const uploadId = crypto.randomUUID();

    try {
      const fileResponse = await fetch(downloadUrl);
      if (!fileResponse.ok) {
        throw new Error(`Document download failed: ${fileResponse.status}`);
      }
      const blob = await fileResponse.blob();
      const result = await uploadImaginaDocument(context, {
        imaginaContractId: params.imaginaContractId,
        file: blob,
        filename,
        tipoFichero,
        cups: params.cups,
      });

      await context.db.execute({
        sql: `INSERT INTO imagina_document_uploads (
                id, tramite_id, contract_id, tramite_file_id, imagina_contract_id,
                tipo_fichero, payload, result, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?)`,
        args: [
          uploadId,
          params.tramiteId,
          params.contractId,
          String(file.id),
          String(params.imaginaContractId),
          tipoFichero,
          JSON.stringify({ filename }),
          JSON.stringify(result.data),
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      });
    } catch (error) {
      await context.db.execute({
        sql: `INSERT INTO imagina_document_uploads (
                id, tramite_id, contract_id, tramite_file_id, imagina_contract_id,
                tipo_fichero, payload, result, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'error', ?, ?)`,
        args: [
          uploadId,
          params.tramiteId,
          params.contractId,
          String(file.id),
          String(params.imaginaContractId),
          tipoFichero,
          JSON.stringify({ filename }),
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      });
    }
  }
};
