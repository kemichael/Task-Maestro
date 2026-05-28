import "server-only";
import { listIssues, createIssue, patchIssue, addComment } from "../clients/backlog";
import { upsertIssues, findAll, findById, findToday, deleteById } from "../db/backlogIssueRepository";
import { getAppSettings } from "../db/settingsRepository";
import type { BacklogIssue } from "../types/backlog";
import type { TicketDraft } from "../types/ticket";
import type { PatchIssueInput } from "../validation/ticketSchema";
import { logger } from "../logger";

export type SyncResult =
  | { skipped: "no_projects" | "self_user_id_missing" }
  | { inserted: number; updated: number; fetched: number };

export async function syncAllProjects(): Promise<SyncResult> {
  const settings = getAppSettings();
  const projectIds = settings.backlog.projects.map((p) => p.projectId);
  if (projectIds.length === 0) {
    logger.warn("対象 Backlog プロジェクトが未設定のため同期をスキップ");
    return { skipped: "no_projects" };
  }
  const selfUserId = settings.backlog.self?.userId;
  if (!selfUserId || selfUserId <= 0) {
    logger.warn("自分の Backlog ユーザ ID が未設定のため同期をスキップ");
    return { skipped: "self_user_id_missing" };
  }

  let offset = 0;
  const pageSize = 100;
  const collected: BacklogIssue[] = [];

  while (true) {
    const page = await listIssues({
      projectIds,
      assigneeIds: [selfUserId],
      count: pageSize,
      offset,
    });
    collected.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
    if (offset >= 1000) break; // 安全のため上限
  }

  const { inserted, updated } = upsertIssues(collected);
  logger.info(
    { inserted, updated, fetched: collected.length, selfUserId },
    "Backlog 同期完了 (担当者フィルタ適用)",
  );
  return { inserted, updated, fetched: collected.length };
}

export async function createTicket(draft: TicketDraft): Promise<BacklogIssue> {
  const issue = await createIssue(draft);
  upsertIssues([issue]);
  return issue;
}

export async function updateTicket(
  issueId: number,
  patch: PatchIssueInput,
): Promise<BacklogIssue> {
  const { commentBody, ...rest } = patch;
  const issue = await patchIssue(issueId, {
    summary: rest.summary,
    description: rest.description,
    statusId: rest.statusId,
    priorityId: rest.priorityId,
    dueDate: rest.dueDate ?? undefined,
    assigneeId: rest.assigneeId ?? undefined,
    categoryIds: rest.categoryIds,
  });
  if (commentBody && commentBody.trim().length > 0) {
    await addComment(issueId, commentBody);
  }
  upsertIssues([issue]);
  return issue;
}

export function listLocalIssues(filter: { projectIds?: number[] } = {}): BacklogIssue[] {
  return findAll(filter);
}

export function getLocalIssue(id: number): BacklogIssue | undefined {
  return findById(id);
}

export function listTodayIssues(today: string = new Date().toISOString().slice(0, 10)): BacklogIssue[] {
  return findToday(today);
}

export function purgeLocalIssue(id: number): void {
  deleteById(id);
}
