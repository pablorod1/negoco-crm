-- SQLite does not support IF NOT EXISTS for ADD COLUMN. Numbered migrations
-- must therefore be recorded and applied once.
ALTER TABLE user ADD COLUMN abarca_user_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS user_abarca_user_id_unique
  ON user(abarca_user_id)
  WHERE abarca_user_id IS NOT NULL;
