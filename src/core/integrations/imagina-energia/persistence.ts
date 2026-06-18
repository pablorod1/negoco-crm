import type { Client, Row } from "@libsql/client";
import type {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
} from "@/tramites/types/tramite.types";
import { IMAGINA_PROVIDER } from "./config";
import {
  ImaginaRateRow,
  isImaginaSupplierName,
} from "./mappers";
import type { NegocoImaginaStatus } from "./state-mapper";

export interface ImaginaTenantIntegration {
  enabled: boolean;
  configured: boolean;
  channelId: string | null;
}

export interface ImaginaSubmissionBundle {
  tramite: TramiteDB;
  client: ClientDB;
  contract: ContractDB;
  signer: SignerDB | null;
  rate: ImaginaRateRow | null;
}

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export const getImaginaIntegration = async (
  db: Client,
): Promise<ImaginaTenantIntegration> => {
  try {
    const result = await db.execute({
      sql: `SELECT enabled, config FROM integrations WHERE provider = ? LIMIT 1`,
      args: [IMAGINA_PROVIDER],
    });

    if (result.rows.length === 0) {
      return { enabled: false, configured: false, channelId: null };
    }

    const row = result.rows[0];
    const config = parseJsonObject(row.config);
    const channelId =
      typeof config.x_canal_id === "string" && config.x_canal_id.trim()
        ? config.x_canal_id.trim()
        : null;
    const enabled = Boolean(row.enabled);

    return {
      enabled,
      configured: enabled && Boolean(channelId),
      channelId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("no such table")) {
      return { enabled: false, configured: false, channelId: null };
    }
    throw error;
  }
};

export const getImaginaComercializadora = async (
  db: Client,
): Promise<Row | null> => {
  const result = await db.execute({
    sql: `SELECT * FROM comercializadoras WHERE active = true`,
    args: [],
  });

  return (
    result.rows.find((row) => isImaginaSupplierName(String(row.name || ""))) ||
    null
  );
};

export const getSelectedImaginaRate = async (
  db: Client,
  contract: ContractDB,
): Promise<ImaginaRateRow | null> => {
  const rateId = contract.rate_id;
  if (!rateId) return null;

  const result = await db.execute({
    sql: `SELECT * FROM comercializadora_rates
          WHERE id = ?
             OR (provider = ? AND external_rate_id = ?)
          LIMIT 1`,
    args: [rateId, IMAGINA_PROVIDER, rateId],
  });

  return (result.rows[0] as unknown as ImaginaRateRow | undefined) || null;
};

export const getSubmissionBundle = async (
  db: Client,
  tramiteId: string,
  contractId?: string | null,
): Promise<ImaginaSubmissionBundle | null> => {
  const tramiteResult = await db.execute({
    sql: `SELECT * FROM tramites WHERE id = ? LIMIT 1`,
    args: [tramiteId],
  });
  if (tramiteResult.rows.length === 0) return null;

  const clientResult = await db.execute({
    sql: `SELECT * FROM clients WHERE id = ? LIMIT 1`,
    args: [String(tramiteResult.rows[0].client_id || "")],
  });
  if (clientResult.rows.length === 0) return null;

  const contractResult = await db.execute({
    sql: contractId
      ? `SELECT * FROM contracts WHERE tramite_id = ? AND id = ? LIMIT 1`
      : `SELECT * FROM contracts WHERE tramite_id = ? ORDER BY id LIMIT 1`,
    args: contractId ? [tramiteId, contractId] : [tramiteId],
  });
  if (contractResult.rows.length === 0) return null;

  const signerResult = await db.execute({
    sql: `SELECT s.* FROM signers s
          INNER JOIN tramites t ON t.client_id = s.client_id
          WHERE t.id = ?
          LIMIT 1`,
    args: [tramiteId],
  });

  const contract = contractResult.rows[0] as unknown as ContractDB;

  return {
    tramite: tramiteResult.rows[0] as unknown as TramiteDB,
    client: clientResult.rows[0] as unknown as ClientDB,
    contract,
    signer: (signerResult.rows[0] as unknown as SignerDB | undefined) || null,
    rate: await getSelectedImaginaRate(db, contract),
  };
};

export const insertContractSubmission = async (
  db: Client,
  params: {
    tramiteId: string;
    contractId: string;
    referenciaExterna: string;
    endpoint: string;
    payload: unknown;
    requestId?: string | number | null;
    response?: unknown;
    status: string;
    validationErrors?: unknown;
  },
): Promise<void> => {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO imagina_contract_submissions (
            id, tramite_id, contract_id, referencia_externa, request_id,
            endpoint, payload, response, status, validation_errors, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(referencia_externa) DO UPDATE SET
            request_id = excluded.request_id,
            response = excluded.response,
            status = excluded.status,
            validation_errors = excluded.validation_errors,
            updated_at = excluded.updated_at`,
    args: [
      crypto.randomUUID(),
      params.tramiteId,
      params.contractId,
      params.referenciaExterna,
      params.requestId == null ? null : String(params.requestId),
      params.endpoint,
      JSON.stringify(params.payload),
      params.response === undefined ? null : JSON.stringify(params.response),
      params.status,
      params.validationErrors === undefined
        ? null
        : JSON.stringify(params.validationErrors),
      now,
      now,
    ],
  });
};

export const findSubmissionByCorrelation = async (
  db: Client,
  params: { requestId?: string | number | null; referenciaExterna?: string | null },
): Promise<Row | null> => {
  if (params.requestId != null) {
    const result = await db.execute({
      sql: `SELECT * FROM imagina_contract_submissions
            WHERE request_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [String(params.requestId)],
    });
    if (result.rows[0]) return result.rows[0];
  }

  if (params.referenciaExterna) {
    const result = await db.execute({
      sql: `SELECT * FROM imagina_contract_submissions
            WHERE referencia_externa = ?
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [params.referenciaExterna],
    });
    if (result.rows[0]) return result.rows[0];
  }

  return null;
};

export const recordWebhookEvent = async (
  db: Client,
  params: {
    eventType: string;
    requestId?: string | number | null;
    notificationId?: string | number | null;
    referenciaExterna?: string | null;
    imaginaContractId?: string | number | null;
    payload: unknown;
    publicUrl: string;
  },
): Promise<{ inserted: boolean; id: string }> => {
  const requestId = params.requestId == null ? null : String(params.requestId);
  const notificationId =
    params.notificationId == null ? null : String(params.notificationId);

  if (requestId || notificationId) {
    const existing = await db.execute({
      sql: `SELECT id FROM imagina_webhook_events
            WHERE event_type = ?
              AND (
                (? IS NOT NULL AND request_id = ?)
                OR (? IS NOT NULL AND notification_id = ?)
              )
            LIMIT 1`,
      args: [
        params.eventType,
        requestId,
        requestId,
        notificationId,
        notificationId,
      ],
    });
    if (existing.rows[0]) {
      return { inserted: false, id: String(existing.rows[0].id) };
    }
  }

  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO imagina_webhook_events (
            id, event_type, request_id, notification_id, referencia_externa,
            imagina_contract_id, payload, public_url, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'accepted', ?)`,
    args: [
      id,
      params.eventType,
      requestId,
      notificationId,
      params.referenciaExterna || null,
      params.imaginaContractId == null ? null : String(params.imaginaContractId),
      JSON.stringify(params.payload),
      params.publicUrl,
      new Date().toISOString(),
    ],
  });

  return { inserted: true, id };
};

export const markWebhookProcessed = async (
  db: Client,
  id: string,
): Promise<void> => {
  await db.execute({
    sql: `UPDATE imagina_webhook_events
          SET status = 'processed', processed_at = ?
          WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
};

export const updateCrmStatusFromImagina = async (
  db: Client,
  tramiteId: string,
  status: NegocoImaginaStatus | null,
  description: string,
): Promise<void> => {
  if (!status) return;

  const current = await db.execute({
    sql: `SELECT status FROM tramites WHERE id = ? LIMIT 1`,
    args: [tramiteId],
  });
  if (!current.rows[0]) return;

  const oldStatus = String(current.rows[0].status || "");
  if (oldStatus === status) return;

  const now = new Date().toISOString();
  const fields = ["status = ?", "updated_at = ?"];
  const args: (string | null)[] = [status, now];

  if (status === "Activo") {
    fields.push("activation_date = ?");
    args.push(now);
  }

  args.push(tramiteId);
  await db.execute({
    sql: `UPDATE tramites SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });

  await db.execute({
    sql: `INSERT INTO tramite_changes (
            id, tramite_id, user_id, change_type, field_name,
            old_value, new_value, description, created_at
          ) VALUES (?, ?, NULL, 'status_change', 'status', ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      tramiteId,
      oldStatus,
      status,
      description,
      now,
    ],
  });
};

export const persistContractSnapshot = async (
  db: Client,
  params: {
    contractId?: string | null;
    tramiteId?: string | null;
    imaginaContractId: string | number;
    imaginaContractCode?: string | null;
    externalReference?: string | null;
    estadoId?: number | null;
    estadoDescripcion?: string | null;
    subestadoId?: number | null;
    subestadoDescripcion?: string | null;
    raw: unknown;
    source: string;
    requestId?: string | number | null;
  },
): Promise<void> => {
  await db.execute({
    sql: `INSERT INTO imagina_contract_snapshots (
            id, contract_id, tramite_id, imagina_contract_id, imagina_contract_code,
            external_reference, estado_id, estado_descripcion, subestado_id,
            subestado_descripcion, raw, source, request_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      params.contractId || null,
      params.tramiteId || null,
      String(params.imaginaContractId),
      params.imaginaContractCode || null,
      params.externalReference || null,
      params.estadoId ?? null,
      params.estadoDescripcion || null,
      params.subestadoId ?? null,
      params.subestadoDescripcion || null,
      JSON.stringify(params.raw),
      params.source,
      params.requestId == null ? null : String(params.requestId),
      new Date().toISOString(),
    ],
  });
};
