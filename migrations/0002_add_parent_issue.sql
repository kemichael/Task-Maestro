-- BD-103: 親課題 ID を保持する列を追加
-- 設計: FR-004 で親課題のキー/タイトルを UI に表示するため

ALTER TABLE backlog_issue ADD COLUMN parent_issue_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_issue_parent
  ON backlog_issue (parent_issue_id);
