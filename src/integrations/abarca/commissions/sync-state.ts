import type { InStatement } from "@libsql/client";

export function enqueueCommissionSyncStatements(userIds: string[]): InStatement[] {
  return [...new Set(userIds)].map((userId) => ({
    sql: `INSERT INTO abarca_commission_sync_state
      (user_id, abarca_user_id, desired_revision, confirmed_revision, status, attempts, next_attempt_at, updated_at)
      SELECT id, abarca_user_id, 1, 0,
        CASE WHEN abarca_user_id IS NULL THEN 'not_applicable' ELSE 'pending' END,
        0, NULL, CURRENT_TIMESTAMP
      FROM user WHERE id = ?
      ON CONFLICT(user_id) DO UPDATE SET
        abarca_user_id = excluded.abarca_user_id,
        desired_revision = abarca_commission_sync_state.desired_revision + 1,
        status = CASE
          WHEN excluded.abarca_user_id IS NULL THEN 'not_applicable'
          WHEN abarca_commission_sync_state.status = 'syncing' THEN 'syncing'
          ELSE 'pending'
        END,
        attempts = 0,
        next_attempt_at = NULL,
        lock_token = CASE
          WHEN excluded.abarca_user_id IS NULL THEN NULL
          ELSE abarca_commission_sync_state.lock_token
        END,
        locked_at = CASE
          WHEN excluded.abarca_user_id IS NULL THEN NULL
          ELSE abarca_commission_sync_state.locked_at
        END,
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP`,
    args: [userId],
  }));
}
