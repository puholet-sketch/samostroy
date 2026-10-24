-- Применить к уже существующей БД:
--   docker compose exec -T postgres psql -U samostroy -d samostroy < docker/postgres/migrations/001_feedback.sql

CREATE TABLE IF NOT EXISTS feedback_items (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('ux', 'bug', 'idea')),
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'done')),
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  route TEXT NOT NULL DEFAULT '',
  page_title TEXT NOT NULL DEFAULT '',
  build_stamp TEXT NOT NULL DEFAULT '',
  markers JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_id TEXT NOT NULL,
  image_path TEXT,
  tg_message_id BIGINT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  sync_error TEXT
);

CREATE INDEX IF NOT EXISTS feedback_items_status_idx ON feedback_items (status);
CREATE INDEX IF NOT EXISTS feedback_items_created_idx ON feedback_items (created_at DESC);
