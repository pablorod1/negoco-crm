import type { Client, Row } from "@libsql/client";
import {
  buildAbarcaPayload,
  describeRemoteDifferences,
  remoteMatches,
} from "./payload";
import { getAbarcaCommissions, putAbarcaCommissions } from "./contract";

const LOCK_MINUTES = 5;

const message = (error: unknown) =>
  (error instanceof Error ? error.message : "Error desconocido").slice(0, 1000);

const key = (segment: string, name: string) =>
  `${segment}:${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase()}`;

async function getEffectiveRows(db: Client, userId: string) {
  const response = await db.execute({
    sql: `SELECT user_rules.comercializadora_id, user_rules.segment,
        user_rules.commission_type, user_rules.commission_value
      FROM user_company_commissions user_rules
      WHERE user_rules.user_id = ?
      UNION ALL
      SELECT defaults.comercializadora_id, defaults.segment,
        defaults.commission_type, defaults.commission_value
      FROM default_company_commissions defaults
      WHERE NOT EXISTS (
        SELECT 1 FROM user_company_commissions user_rules
        WHERE user_rules.user_id = ?
          AND user_rules.comercializadora_id = defaults.comercializadora_id
          AND user_rules.segment = defaults.segment
      )`,
    args: [userId, userId],
  });
  return response.rows;
}

async function loadInputs(db: Client, userId: string, abarcaUserId: number) {
  const [effective, mappings, managed] = await Promise.all([
    getEffectiveRows(db, userId),
    db.execute(`SELECT comercializadora_id, segment, abarca_name
      FROM abarca_commission_mappings ORDER BY segment, abarca_name`),
    db.execute({
      sql: `SELECT abarca_name, segment, commission_type, desired_value
        FROM abarca_commission_managed_rules WHERE user_id = ? AND abarca_user_id = ?`,
      args: [userId, abarcaUserId],
    }),
  ]);
  return { effective, mappings: mappings.rows, managed: managed.rows };
}

/** Comprueba el estado remoto sin modificarlo ni incrementar la revisión. */
export async function inspectCommissionUser(
  db: Client,
  userId: string,
  abarcaUserId: number,
) {
  const remote = await getAbarcaCommissions(abarcaUserId);
  const inputs = await loadInputs(db, userId, abarcaUserId);
  const payload = buildAbarcaPayload(
    inputs.effective,
    inputs.mappings,
    inputs.managed,
    remote.catalog,
  );
  const differences = describeRemoteDifferences(payload.rules, remote.rules);
  const warnings = [...remote.warnings, ...payload.unresolved, ...differences];
  if (remote.personalized !== null) {
    warnings.push(
      `Comisión personalizada global activa en el Comparador: ${remote.personalized ?? "valor desconocido"}`,
    );
  }
  return { matches: warnings.length === 0, warnings };
}

async function markFailure(
  db: Client,
  userId: string,
  revision: number,
  lockToken: string,
  error: unknown,
) {
  const detail = message(error);
  await db.execute({
    sql: `UPDATE abarca_commission_sync_state SET
      status = 'attention',
      attempts = attempts + 1,
      next_attempt_at = NULL,
      lock_token = NULL, locked_at = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND desired_revision = ? AND lock_token = ?`,
    args: [detail, userId, revision, lockToken],
  });
  await db.execute({
    sql: `UPDATE abarca_commission_sync_state SET status = 'pending',
      next_attempt_at = NULL, lock_token = NULL, locked_at = NULL,
      updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND lock_token = ? AND desired_revision <> ?`,
    args: [userId, lockToken, revision],
  });
}

export async function synchronizeCommissionUser(
  db: Client,
  state: Row,
): Promise<"synced" | "attention" | "skipped"> {
  const userId = String(state.user_id);
  const revision = Number(state.desired_revision);
  const lockToken = crypto.randomUUID();
  const claimed = await db.execute({
    sql: `UPDATE abarca_commission_sync_state
      SET status = 'syncing', lock_token = ?, locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND desired_revision = ?
        AND status IN ('pending', 'attention')
        AND (locked_at IS NULL OR locked_at < datetime('now', '-${LOCK_MINUTES} minutes'))`,
    args: [lockToken, userId, revision],
  });
  if (claimed.rowsAffected !== 1) return "skipped";

  try {
    const identity = (await db.execute({
      sql: "SELECT abarca_user_id FROM user WHERE id = ?",
      args: [userId],
    })).rows[0]?.abarca_user_id;
    if (identity === null || identity === undefined || !Number.isSafeInteger(Number(identity))) {
      await db.execute({
        sql: `UPDATE abarca_commission_sync_state SET status = 'not_applicable', abarca_user_id = NULL,
          next_attempt_at = NULL, lock_token = NULL, locked_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND lock_token = ?`,
        args: [userId, lockToken],
      });
      return "skipped";
    }
    const abarcaUserId = Number(identity);
    const before = await getAbarcaCommissions(abarcaUserId);
    const inputs = await loadInputs(db, userId, abarcaUserId);
    const payload = buildAbarcaPayload(inputs.effective, inputs.mappings, inputs.managed, before.catalog);
    const putResult = await putAbarcaCommissions(abarcaUserId, payload.rules);
    const after = await getAbarcaCommissions(abarcaUserId);
    if (!putResult.ok || !remoteMatches(payload.rules, after.rules) || after.personalized !== null) {
      const differences = describeRemoteDifferences(payload.rules, after.rules);
      if (after.personalized !== null) {
        differences.push("El Comparador mantiene una comisión personalizada global");
      }
      throw new Error(
        differences.length > 0
          ? differences.join("; ")
          : "El Comparador no confirmó el estado enviado",
      );
    }

    const current = await db.execute({
      sql: "SELECT desired_revision FROM abarca_commission_sync_state WHERE user_id = ? AND lock_token = ?",
      args: [userId, lockToken],
    });
    if (Number(current.rows[0]?.desired_revision) !== revision) {
      await db.execute({
        sql: `UPDATE abarca_commission_sync_state SET status = 'pending',
          next_attempt_at = NULL, lock_token = NULL, locked_at = NULL,
          updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND lock_token = ?`,
        args: [userId, lockToken],
      });
      return "skipped";
    }

    const statements = payload.rules.map((rule) => ({
      sql: `INSERT INTO abarca_commission_managed_rules
        (id, user_id, abarca_user_id, abarca_name, segment, commission_type,
         desired_value, desired_revision, confirmed_revision, retiring, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, abarca_user_id, abarca_name, segment) DO UPDATE SET
          abarca_user_id = excluded.abarca_user_id,
          commission_type = excluded.commission_type,
          desired_value = excluded.desired_value,
          desired_revision = excluded.desired_revision,
          confirmed_revision = excluded.confirmed_revision,
          retiring = excluded.retiring,
          updated_at = CURRENT_TIMESTAMP`,
      args: [
        crypto.randomUUID(), userId, abarcaUserId, rule.comercializadora, rule.segmento,
        rule.tipo === "fija" ? "fixed" : "percent", rule.valor, revision, revision,
        payload.retiringKeys.has(key(rule.segmento, rule.comercializadora)) ? 1 : 0,
      ],
    }));
    const warnings = [...putResult.warnings, ...after.warnings, ...payload.unresolved];
    statements.push({
      sql: `UPDATE abarca_commission_sync_state SET
        abarca_user_id = ?, confirmed_revision = ?,
        status = ?, payload_hash = ?, attempts = 0, next_attempt_at = NULL,
        lock_token = NULL, locked_at = NULL, last_error = NULL, last_warnings = ?,
        last_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND desired_revision = ? AND lock_token = ?`,
      args: [abarcaUserId, revision, warnings.length ? "attention" : "synced",
        payload.hash, JSON.stringify(warnings),
        userId, revision, lockToken],
    });
    statements.push({
      sql: `INSERT INTO abarca_commission_audit
        (id, user_id, revision, event, details) VALUES (?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), userId, revision, "confirmed", JSON.stringify({
        rules: payload.rules.length,
        unresolved: payload.unresolved,
      })],
    });
    await db.batch(statements, "write");
    return warnings.length ? "attention" : "synced";
  } catch (error) {
    await markFailure(db, userId, revision, lockToken, error);
    return "attention";
  }
}
