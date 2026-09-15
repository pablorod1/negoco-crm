export type ForumTopicStatus = "open" | "closed";

export interface ForumTopic {
  id: string;
  title: string;
  description: string | null;
  status: ForumTopicStatus;
  comments_count: number;
  hidden_comments_count?: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  created_by_name?: string | null;
}

export interface ForumComment {
  id: string;
  topic_id: string;
  message: string;
  author_label: string;
  created_at: string;
  updated_at: string;
  is_hidden?: boolean;
  hidden_at?: string | null;
  hidden_by_name?: string | null;
  author_id?: string;
  author_name?: string | null;
  author_email?: string | null;
  author_role?: string | null;
}

export interface ForumTopicDetail {
  topic: ForumTopic;
  comments: ForumComment[];
}

export interface CreateForumTopicPayload {
  title: string;
  description?: string;
}

export interface UpdateForumTopicPayload {
  title?: string;
  description?: string | null;
  status?: ForumTopicStatus;
}

export interface CreateForumCommentPayload {
  message: string;
}

export interface UpdateForumCommentPayload {
  is_hidden: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
