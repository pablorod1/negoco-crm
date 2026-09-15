import type { Client } from "@libsql/client";
import type {
  DashboardAnnouncement,
  DashboardAnnouncementPayload,
  UpdateDashboardAnnouncementPayload,
} from "./types";

type Row = Record<string, unknown>;

const nowIso = () => new Date().toISOString();

const toNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const toStringValue = (value: unknown): string => String(value ?? "");

const toBoolean = (value: unknown): boolean => Number(value ?? 0) === 1;

const mapDashboardAnnouncement = (
  row: Row,
): DashboardAnnouncement => ({
  id: toStringValue(row.id),
  title: toStringValue(row.title),
  message: toStringValue(row.message),
  variant: toStringValue(row.variant) as DashboardAnnouncement["variant"],
  cta_label: toNullableString(row.cta_label),
  cta_url: toNullableString(row.cta_url),
  is_active: toBoolean(row.is_active),
  created_by: toStringValue(row.created_by),
  created_by_name: toNullableString(row.created_by_name),
  created_at: toStringValue(row.created_at),
  updated_at: toStringValue(row.updated_at),
  deactivated_at: toNullableString(row.deactivated_at),
});

export async function getActiveDashboardAnnouncement(
  tursoClient: Client,
): Promise<DashboardAnnouncement | null> {
  const result = await tursoClient.execute({
    sql: `
      SELECT a.*, u.name as created_by_name
      FROM dashboard_announcements a
      LEFT JOIN user u ON a.created_by = u.id
      WHERE a.is_active = 1
      ORDER BY a.updated_at DESC
      LIMIT 1
    `,
  });

  return result.rows[0] ? mapDashboardAnnouncement(result.rows[0]) : null;
}

export async function createDashboardAnnouncement(
  tursoClient: Client,
  payload: DashboardAnnouncementPayload,
  userId: string,
): Promise<DashboardAnnouncement> {
  const id = crypto.randomUUID();
  const timestamp = nowIso();

  await tursoClient.execute({
    sql: `
      UPDATE dashboard_announcements
      SET is_active = 0,
          deactivated_at = ?,
          updated_at = ?
      WHERE is_active = 1
    `,
    args: [timestamp, timestamp],
  });

  await tursoClient.execute({
    sql: `
      INSERT INTO dashboard_announcements (
        id, title, message, variant, cta_label, cta_url, is_active,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `,
    args: [
      id,
      payload.title,
      payload.message,
      payload.variant,
      payload.cta_label || null,
      payload.cta_url || null,
      userId,
      timestamp,
      timestamp,
    ],
  });

  const announcement = await getDashboardAnnouncementById(tursoClient, id);
  if (!announcement) {
    throw new Error("dashboard announcement insert did not return a row");
  }

  return announcement;
}

async function getDashboardAnnouncementById(
  tursoClient: Client,
  id: string,
): Promise<DashboardAnnouncement | null> {
  const result = await tursoClient.execute({
    sql: `
      SELECT a.*, u.name as created_by_name
      FROM dashboard_announcements a
      LEFT JOIN user u ON a.created_by = u.id
      WHERE a.id = ?
    `,
    args: [id],
  });

  return result.rows[0] ? mapDashboardAnnouncement(result.rows[0]) : null;
}

export async function updateDashboardAnnouncement(
  tursoClient: Client,
  id: string,
  payload: UpdateDashboardAnnouncementPayload,
): Promise<DashboardAnnouncement | null> {
  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  const timestamp = nowIso();

  if (payload.is_active === true) {
    await tursoClient.execute({
      sql: `
        UPDATE dashboard_announcements
        SET is_active = 0,
            deactivated_at = ?,
            updated_at = ?
        WHERE is_active = 1 AND id != ?
      `,
      args: [timestamp, timestamp, id],
    });
  }

  if (payload.title !== undefined) {
    fields.push("title = ?");
    args.push(payload.title);
  }

  if (payload.message !== undefined) {
    fields.push("message = ?");
    args.push(payload.message);
  }

  if (payload.variant !== undefined) {
    fields.push("variant = ?");
    args.push(payload.variant);
  }

  if (payload.cta_label !== undefined) {
    fields.push("cta_label = ?");
    args.push(payload.cta_label || null);
  }

  if (payload.cta_url !== undefined) {
    fields.push("cta_url = ?");
    args.push(payload.cta_url || null);
  }

  if (payload.is_active !== undefined) {
    fields.push("is_active = ?");
    args.push(payload.is_active ? 1 : 0);
    fields.push("deactivated_at = ?");
    args.push(payload.is_active ? null : timestamp);
  }

  if (fields.length === 0) {
    return getDashboardAnnouncementById(tursoClient, id);
  }

  fields.push("updated_at = ?");
  args.push(timestamp);
  args.push(id);

  const result = await tursoClient.execute({
    sql: `UPDATE dashboard_announcements SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });

  if (result.rowsAffected === 0) {
    return null;
  }

  return getDashboardAnnouncementById(tursoClient, id);
}
