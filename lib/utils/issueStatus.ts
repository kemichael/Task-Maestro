import type { BacklogIssue } from "../types/backlog";

/**
 * Backlog 標準の「完了」ステータス ID。
 * 1: 未対応 / 2: 処理中 / 3: 処理済み / 4: 完了
 */
export const BACKLOG_COMPLETED_STATUS_ID = 4;

/**
 * カスタムステータスでも「完了」と扱う名前のヒューリスティック。
 * 日本語の「完了」と英語圏の Done/Closed/Resolved を対象。
 */
const COMPLETED_STATUS_NAMES: ReadonlyArray<string> = [
  "完了",
  "Done",
  "Closed",
  "Resolved",
];

export function isCompletedStatus(status: { id: number; name: string }): boolean {
  if (status.id === BACKLOG_COMPLETED_STATUS_ID) return true;
  const normalized = status.name.trim();
  return COMPLETED_STATUS_NAMES.some(
    (n) => normalized === n || normalized.toLowerCase() === n.toLowerCase(),
  );
}

export function isCompletedIssue(issue: BacklogIssue): boolean {
  return isCompletedStatus(issue.status);
}
