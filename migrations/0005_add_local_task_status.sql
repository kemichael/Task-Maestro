-- ローカルタスクに 4 段階ステータスを追加
-- todo / in_progress / resolved / done (カンバン列と一致)
-- 既存行は 'todo'、completed_at が立っているものは 'done' とみなす

ALTER TABLE local_task ADD COLUMN status TEXT NOT NULL DEFAULT 'todo';

UPDATE local_task SET status = 'done' WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_local_task_status ON local_task (status);
