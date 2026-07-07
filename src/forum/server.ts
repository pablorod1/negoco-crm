import type { Client } from "@libsql/client";
import type {
  ForumComment,
  ForumTopic,
  ForumTopicDetail,
  ForumTopicStatus,
} from "./types";

type Row = Record<string, unknown>;

const nowIso = () => new Date().toISOString();

export const isDireccionRole = (role: string) => role === "admin";

const toNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const toStringValue = (value: unknown): string => String(value ?? "");

const toNumber = (value: unknown): number => Number(value ?? 0);

const toBoolean = (value: unknown): boolean => Number(value ?? 0) === 1;

const mapForumTopic = (
  row: Row,
  includeManagerFields: boolean,
): ForumTopic => {
  const totalComments = toNumber(row.comments_count);
  const visibleComments = toNumber(row.visible_comments_count);
  const hiddenComments = Math.max(totalComments - visibleComments, 0);

  return {
    id: toStringValue(row.id),
    title: toStringValue(row.title),
    description: toNullableString(row.description),
    status: toStringValue(row.status) as ForumTopicStatus,
    comments_count: includeManagerFields ? totalComments : visibleComments,
    hidden_comments_count: includeManagerFields ? hiddenComments : undefined,
    created_at: toStringValue(row.created_at),
    updated_at: toStringValue(row.updated_at),
    closed_at: toNullableString(row.closed_at),
    created_by_name: includeManagerFields
      ? toNullableString(row.created_by_name)
      : undefined,
  };
};

const mapForumComment = (
  row: Row,
  includeManagerFields: boolean,
): ForumComment => {
  const baseComment: ForumComment = {
    id: toStringValue(row.id),
    topic_id: toStringValue(row.topic_id),
    message: toStringValue(row.message),
    author_label: toStringValue(row.alias_label || "Usuario"),
    created_at: toStringValue(row.created_at),
    updated_at: toStringValue(row.updated_at),
  };

  if (!includeManagerFields) {
    return baseComment;
  }

  return {
    ...baseComment,
    is_hidden: toBoolean(row.is_hidden),
    hidden_at: toNullableString(row.hidden_at),
    hidden_by_name: toNullableString(row.hidden_by_name),
    author_id: toStringValue(row.author_id),
    author_name: toNullableString(row.author_name),
    author_email: toNullableString(row.author_email),
    author_role: toNullableString(row.author_role),
  };
};

export async function listForumTopics(
  tursoClient: Client,
  includeManagerFields: boolean,
): Promise<ForumTopic[]> {
  const result = await tursoClient.execute({
    sql: `
      SELECT
        t.*,
        u.name as created_by_name,
        COUNT(c.id) as comments_count,
        SUM(CASE WHEN c.is_hidden = 0 THEN 1 ELSE 0 END) as visible_comments_count,
        MAX(c.created_at) as last_comment_at
      FROM forum_topics t
      LEFT JOIN user u ON t.created_by = u.id
      LEFT JOIN forum_comments c ON c.topic_id = t.id
      GROUP BY t.id, u.name
      ORDER BY
        CASE WHEN t.status = 'open' THEN 0 ELSE 1 END,
        COALESCE(MAX(c.created_at), t.updated_at, t.created_at) DESC
    `,
  });

  return result.rows.map((row) => mapForumTopic(row, includeManagerFields));
}

export async function createForumTopic(
  tursoClient: Client,
  title: string,
  description: string | null,
  userId: string,
): Promise<ForumTopic> {
  const id = crypto.randomUUID();
  const timestamp = nowIso();

  await tursoClient.execute({
    sql: `
      INSERT INTO forum_topics (
        id, title, description, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, 'open', ?, ?, ?)
    `,
    args: [id, title, description, userId, timestamp, timestamp],
  });

  const topic = await getForumTopic(tursoClient, id, true);
  if (!topic) {
    throw new Error("forum topic insert did not return a readable row");
  }

  return topic.topic;
}

export async function getForumTopic(
  tursoClient: Client,
  topicId: string,
  includeManagerFields: boolean,
): Promise<ForumTopicDetail | null> {
  const topicResult = await tursoClient.execute({
    sql: `
      SELECT
        t.*,
        u.name as created_by_name,
        COUNT(c.id) as comments_count,
        SUM(CASE WHEN c.is_hidden = 0 THEN 1 ELSE 0 END) as visible_comments_count
      FROM forum_topics t
      LEFT JOIN user u ON t.created_by = u.id
      LEFT JOIN forum_comments c ON c.topic_id = t.id
      WHERE t.id = ?
      GROUP BY t.id, u.name
    `,
    args: [topicId],
  });

  const topicRow = topicResult.rows[0];
  if (!topicRow) {
    return null;
  }

  const commentsWhere = includeManagerFields
    ? "WHERE c.topic_id = ?"
    : "WHERE c.topic_id = ? AND c.is_hidden = 0";

  const commentsResult = await tursoClient.execute({
    sql: `
      SELECT
        c.*,
        p.alias_label,
        u.name as author_name,
        u.email as author_email,
        u.role as author_role,
        hidden_user.name as hidden_by_name
      FROM forum_comments c
      LEFT JOIN forum_topic_participants p
        ON p.topic_id = c.topic_id AND p.user_id = c.author_id
      LEFT JOIN user u ON c.author_id = u.id
      LEFT JOIN user hidden_user ON c.hidden_by = hidden_user.id
      ${commentsWhere}
      ORDER BY c.created_at ASC
    `,
    args: [topicId],
  });

  return {
    topic: mapForumTopic(topicRow, includeManagerFields),
    comments: commentsResult.rows.map((row) =>
      mapForumComment(row, includeManagerFields),
    ),
  };
}

export async function updateForumTopic(
  tursoClient: Client,
  topicId: string,
  input: {
    title?: string;
    description?: string | null;
    status?: ForumTopicStatus;
  },
): Promise<ForumTopicDetail | null> {
  const fields: string[] = [];
  const args: (string | null)[] = [];
  const timestamp = nowIso();

  if (input.title !== undefined) {
    fields.push("title = ?");
    args.push(input.title);
  }

  if (input.description !== undefined) {
    fields.push("description = ?");
    args.push(input.description);
  }

  if (input.status !== undefined) {
    fields.push("status = ?");
    args.push(input.status);
    fields.push("closed_at = ?");
    args.push(input.status === "closed" ? timestamp : null);
  }

  if (fields.length === 0) {
    return getForumTopic(tursoClient, topicId, true);
  }

  fields.push("updated_at = ?");
  args.push(timestamp);
  args.push(topicId);

  const result = await tursoClient.execute({
    sql: `UPDATE forum_topics SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });

  if (result.rowsAffected === 0) {
    return null;
  }

  return getForumTopic(tursoClient, topicId, true);
}

async function ensureParticipantAlias(
  tursoClient: Client,
  topicId: string,
  userId: string,
): Promise<string> {
  const existing = await tursoClient.execute({
    sql: `
      SELECT alias_label
      FROM forum_topic_participants
      WHERE topic_id = ? AND user_id = ?
    `,
    args: [topicId, userId],
  });

  const existingLabel = existing.rows[0]?.alias_label;
  if (existingLabel) {
    return String(existingLabel);
  }

  const nextAliasResult = await tursoClient.execute({
    sql: `
      SELECT COALESCE(MAX(alias_number), 0) + 1 as next_alias
      FROM forum_topic_participants
      WHERE topic_id = ?
    `,
    args: [topicId],
  });

  const aliasNumber = Number(nextAliasResult.rows[0]?.next_alias || 1);
  const aliasLabel = `Usuario ${aliasNumber}`;

  try {
    await tursoClient.execute({
      sql: `
        INSERT INTO forum_topic_participants (
          id, topic_id, user_id, alias_number, alias_label, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        topicId,
        userId,
        aliasNumber,
        aliasLabel,
        nowIso(),
      ],
    });
    return aliasLabel;
  } catch (error) {
    const retry = await tursoClient.execute({
      sql: `
        SELECT alias_label
        FROM forum_topic_participants
        WHERE topic_id = ? AND user_id = ?
      `,
      args: [topicId, userId],
    });

    const retryLabel = retry.rows[0]?.alias_label;
    if (retryLabel) {
      return String(retryLabel);
    }

    throw error;
  }
}

export async function createForumComment(
  tursoClient: Client,
  topicId: string,
  userId: string,
  message: string,
  includeManagerFields: boolean,
): Promise<ForumComment | "closed" | null> {
  const topicResult = await tursoClient.execute({
    sql: "SELECT id, status FROM forum_topics WHERE id = ?",
    args: [topicId],
  });

  const topic = topicResult.rows[0];
  if (!topic) {
    return null;
  }

  if (topic.status === "closed") {
    return "closed";
  }

  await ensureParticipantAlias(tursoClient, topicId, userId);

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  await tursoClient.execute({
    sql: `
      INSERT INTO forum_comments (
        id, topic_id, author_id, message, is_hidden, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?)
    `,
    args: [id, topicId, userId, message, timestamp, timestamp],
  });

  await tursoClient.execute({
    sql: "UPDATE forum_topics SET updated_at = ? WHERE id = ?",
    args: [timestamp, topicId],
  });

  return getForumComment(tursoClient, id, includeManagerFields);
}

async function getForumComment(
  tursoClient: Client,
  commentId: string,
  includeManagerFields: boolean,
): Promise<ForumComment | null> {
  const result = await tursoClient.execute({
    sql: `
      SELECT
        c.*,
        p.alias_label,
        u.name as author_name,
        u.email as author_email,
        u.role as author_role,
        hidden_user.name as hidden_by_name
      FROM forum_comments c
      LEFT JOIN forum_topic_participants p
        ON p.topic_id = c.topic_id AND p.user_id = c.author_id
      LEFT JOIN user u ON c.author_id = u.id
      LEFT JOIN user hidden_user ON c.hidden_by = hidden_user.id
      WHERE c.id = ?
    `,
    args: [commentId],
  });

  const row = result.rows[0];
  return row ? mapForumComment(row, includeManagerFields) : null;
}

export async function updateForumCommentVisibility(
  tursoClient: Client,
  commentId: string,
  isHidden: boolean,
  managerUserId: string,
): Promise<ForumComment | null> {
  const timestamp = nowIso();
  const result = await tursoClient.execute({
    sql: `
      UPDATE forum_comments
      SET is_hidden = ?,
          hidden_by = ?,
          hidden_at = ?,
          updated_at = ?
      WHERE id = ?
    `,
    args: [
      isHidden ? 1 : 0,
      isHidden ? managerUserId : null,
      isHidden ? timestamp : null,
      timestamp,
      commentId,
    ],
  });

  if (result.rowsAffected === 0) {
    return null;
  }

  return getForumComment(tursoClient, commentId, true);
}
