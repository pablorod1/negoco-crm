CREATE TABLE IF NOT EXISTS forum_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  FOREIGN KEY (created_by) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS idx_forum_topics_status_updated
  ON forum_topics(status, updated_at);

CREATE TABLE IF NOT EXISTS forum_topic_participants (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  alias_number INTEGER NOT NULL,
  alias_label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (topic_id, user_id),
  UNIQUE (topic_id, alias_number),
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS idx_forum_topic_participants_topic
  ON forum_topic_participants(topic_id);

CREATE TABLE IF NOT EXISTS forum_comments (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  hidden_by TEXT,
  hidden_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES user(id),
  FOREIGN KEY (hidden_by) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_topic_created
  ON forum_comments(topic_id, created_at);

CREATE INDEX IF NOT EXISTS idx_forum_comments_visible
  ON forum_comments(topic_id, is_hidden, created_at);

CREATE TABLE IF NOT EXISTS dashboard_announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'info' CHECK (variant IN ('info', 'warning', 'success', 'danger')),
  cta_label TEXT,
  cta_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deactivated_at TEXT,
  FOREIGN KEY (created_by) REFERENCES user(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_announcements_single_active
  ON dashboard_announcements(is_active)
  WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_dashboard_announcements_active_updated
  ON dashboard_announcements(is_active, updated_at);
