-- BD-103-02: 初期スキーマ
-- 設計: docs/memo-flow/03_detailed_design.md (BD-103) 参照

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_identity (
  service TEXT NOT NULL,
  identifier TEXT NOT NULL,
  display_name TEXT,
  PRIMARY KEY (service, identifier)
);

CREATE TABLE IF NOT EXISTS slack_mention (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  permalink TEXT NOT NULL,
  ticket_id INTEGER,
  processed_at TEXT,
  fetched_at TEXT NOT NULL,
  UNIQUE (workspace_id, ts)
);

CREATE INDEX IF NOT EXISTS idx_mention_unprocessed
  ON slack_mention (processed_at, ts DESC);

CREATE TABLE IF NOT EXISTS meeting_doc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_event_id TEXT NOT NULL UNIQUE,
  document_id TEXT,
  title TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  doc_url TEXT,
  candidates_json TEXT,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS backlog_issue (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  issue_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  status_id INTEGER NOT NULL,
  status_name TEXT NOT NULL,
  priority_id INTEGER,
  priority_name TEXT,
  assignee_id INTEGER,
  assignee_name TEXT,
  due_date TEXT,
  updated_at TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  today_flag INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_issue_today
  ON backlog_issue (today_flag, due_date);
CREATE INDEX IF NOT EXISTS idx_issue_project
  ON backlog_issue (project_id);

CREATE TABLE IF NOT EXISTS imported_document (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  candidates_json TEXT,
  UNIQUE (source_type, source_ref)
);
