import "server-only";
import { listTodayIssues, updateTicket } from "./backlogIssueService";
import { getAppSettings } from "../db/settingsRepository";
import { findById, setTodayFlag } from "../db/backlogIssueRepository";
import type { BacklogIssue } from "../types/backlog";
import { MappingMissingError, NotFoundError } from "../errors";
import { logger } from "../logger";

function priorityRank(priority?: BacklogIssue["priority"]): number {
  if (!priority) return 4;
  const map: Record<string, number> = { "高": 1, "中": 2, "低": 3, "High": 1, "Normal": 2, "Low": 3 };
  return map[priority.name] ?? 4;
}

export function getTodayList(today: string = new Date().toISOString().slice(0, 10)): BacklogIssue[] {
  const issues = listTodayIssues(today);
  const dedup = new Map<number, BacklogIssue>();
  for (const issue of issues) dedup.set(issue.id, issue);
  return Array.from(dedup.values()).sort((a, b) => {
    const aDue = a.dueDate ?? "9999-99-99";
    const bDue = b.dueDate ?? "9999-99-99";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function toggleTodayFlag(issueId: number, flag: boolean): void {
  setTodayFlag(issueId, flag);
}

export async function markStarted(issueId: number): Promise<BacklogIssue> {
  const settings = getAppSettings();
  const target = findById(issueId);
  if (!target) {
    throw new NotFoundError(`チケット ${issueId} がローカルキャッシュに存在しません`);
  }
  const mapping = settings.statusMapping.find((m) => m.projectId === target.projectId);
  if (!mapping) {
    throw new MappingMissingError(target.projectId);
  }
  logger.info(
    { issueId, projectId: target.projectId, statusId: mapping.inProgressStatusId },
    "「処理中」相当に状態遷移",
  );
  return updateTicket(issueId, { statusId: mapping.inProgressStatusId });
}
