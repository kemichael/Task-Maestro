import "server-only";
import { listIssues, listIssuesByIds, createIssue, patchIssue, addComment } from "../clients/backlog";
import {
  upsertIssues,
  findAll,
  findById,
  findByIds,
  findToday,
  deleteById,
  deleteByIds,
  findIdsByAssignee,
} from "../db/backlogIssueRepository";
import { getAppSettings } from "../db/settingsRepository";
import type { BacklogIssue } from "../types/backlog";
import type { TicketDraft } from "../types/ticket";
import type { PatchIssueInput } from "../validation/ticketSchema";
import { logger } from "../logger";
import { todayJst } from "../utils/date";

export type SyncResult =
  | { skipped: "no_projects" | "self_user_id_missing" }
  | {
      inserted: number;
      updated: number;
      removed: number;
      fetched: number;
    };

/**
 * Backlog から取得した自分担当チケット ID 群と、
 * ローカル DB の「assignee_id == selfUserId」チケット ID 群との
 * 差集合 (ローカルにあるが今回 fetch に無い ID) を返す純粋関数。
 *
 * sync 戦略: Backlog の API は `assigneeId` フィルタ付きで取得しているため、
 * 担当が外れたチケットは fetch 結果に含まれない。ローカル側に残り続ける
 * これらのチケットを特定して削除対象にする。
 */
export function diffRemovedIssueIds(
  fetchedIds: ReadonlyArray<number>,
  localSelfAssignedIds: ReadonlyArray<number>,
): number[] {
  const fetchedSet = new Set(fetchedIds);
  return localSelfAssignedIds.filter((id) => !fetchedSet.has(id));
}

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
  const fetchCap = 1000;
  const collected: BacklogIssue[] = [];
  let reachedFetchCap = false;

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
    if (offset >= fetchCap) {
      reachedFetchCap = true;
      break; // 安全のため上限
    }
  }

  const { inserted, updated } = upsertIssues(collected);

  // 担当が外れたチケットをローカルから削除する。
  // ページング上限に達した場合 (全件取得できていない可能性) は誤削除を避けて skip。
  let removed = 0;
  if (reachedFetchCap) {
    logger.warn(
      { fetchCap, fetched: collected.length },
      "ページング上限到達のため担当外れチケットの削除をスキップ",
    );
  } else {
    const localSelfIds = findIdsByAssignee(selfUserId);
    const removedIds = diffRemovedIssueIds(
      collected.map((i) => i.id),
      localSelfIds,
    );
    if (removedIds.length > 0) {
      removed = deleteByIds(removedIds);
      logger.info(
        { removed, removedIds, selfUserId },
        "Backlog で担当外れたチケットをローカルから削除",
      );
    }
  }

  logger.info(
    { inserted, updated, removed, fetched: collected.length, selfUserId },
    "Backlog 同期完了 (担当者フィルタ適用)",
  );

  // 親課題を補助取得 (UI で「親キー: タイトル」を表示するため)。
  // 上の削除処理によって、以前 self-assigned だった親チケットも消えている
  // 可能性があるため、削除後に missing parent を再計算する。
  const parentIds = new Set<number>();
  for (const issue of collected) {
    if (issue.parentIssueId) parentIds.add(issue.parentIssueId);
  }
  if (parentIds.size > 0) {
    const localParents = findByIds(Array.from(parentIds));
    const localParentIdSet = new Set(localParents.map((p) => p.id));
    const missingParentIds = Array.from(parentIds).filter((id) => !localParentIdSet.has(id));
    if (missingParentIds.length > 0) {
      try {
        const fetchedParents = await listIssuesByIds(missingParentIds);
        if (fetchedParents.length > 0) {
          upsertIssues(fetchedParents);
          logger.info(
            { fetchedParents: fetchedParents.length, requested: missingParentIds.length },
            "親課題の補助取得完了",
          );
        }
      } catch (error) {
        // 親取得失敗は致命的でないため警告にとどめる
        logger.warn({ error, count: missingParentIds.length }, "親課題の補助取得に失敗");
      }
    }
  }

  return { inserted, updated, removed, fetched: collected.length };
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
  const settings = getAppSettings();
  const selfUserId = settings.backlog.self?.userId;
  return findAll({
    ...filter,
    ...(selfUserId ? { assigneeIds: [selfUserId] } : {}),
  });
}

export function listAllLocalIssues(): BacklogIssue[] {
  // 親課題を含むキャッシュ全件 (UI 側で親 lookup する用)
  return findAll({});
}

export function getLocalIssue(id: number): BacklogIssue | undefined {
  return findById(id);
}

export function listLocalIssuesByIds(ids: number[]): BacklogIssue[] {
  return findByIds(ids);
}

export function listTodayIssues(today: string = todayJst()): BacklogIssue[] {
  const settings = getAppSettings();
  const selfUserId = settings.backlog.self?.userId;
  return findToday(today, selfUserId);
}

export function purgeLocalIssue(id: number): void {
  deleteById(id);
}
