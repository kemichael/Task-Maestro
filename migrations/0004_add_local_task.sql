-- Backlog に登録しないローカルメモタスクを保持
-- 今日のタスク画面に「メモタスク」セクションとして表示し、Google カレンダーへの D&D 対応

CREATE TABLE IF NOT EXISTS local_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT,
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_task_open
  ON local_task (completed_at, due_date);
