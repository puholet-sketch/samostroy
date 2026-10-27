-- Дневные отчёты по объекту + ссылки контроля (фаза local pro stack).
-- Медиа-файлы по-прежнему в IndexedDB браузера; в БД — метаданные отчёта.
-- FK нет: публичная форма может сохранить отчёт по token до синхронизации ссылки.

CREATE TABLE IF NOT EXISTS control_links (
  token TEXT PRIMARY KEY,
  client_id TEXT NOT NULL DEFAULT '',
  object_id TEXT NOT NULL DEFAULT '',
  object_title TEXT NOT NULL DEFAULT '',
  object_address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS control_links_client_idx ON control_links (client_id);

CREATE TABLE IF NOT EXISTS object_reports (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  report_date DATE NOT NULL,
  work_done TEXT NOT NULL DEFAULT '',
  problems TEXT NOT NULL DEFAULT '',
  worker_name TEXT NOT NULL DEFAULT '',
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token, report_date)
);

CREATE INDEX IF NOT EXISTS object_reports_token_idx ON object_reports (token);
CREATE INDEX IF NOT EXISTS object_reports_date_idx ON object_reports (report_date DESC);
