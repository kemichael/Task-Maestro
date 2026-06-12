-- Meet 議事録 (Google Docs) の検出結果を保持し、処理済み管理に使う
-- 0001_init.sql で作成済みの meeting_doc テーブルに created_at / updated_at を追加する
ALTER TABLE meeting_doc ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE meeting_doc ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_meeting_doc_unprocessed
  ON meeting_doc (processed_at, occurred_at);
