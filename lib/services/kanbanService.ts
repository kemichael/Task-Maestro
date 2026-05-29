import "server-only";
import { findAll, findToday } from "../db/backlogIssueRepository";
import { listLocalTasks } from "../db/localTaskRepository";
import { getAppSettings } from "../db/settingsRepository";
import type { BacklogIssue } from "../types/backlog";
import type { LocalTask } from "../types/localTask";
import {
  KANBAN_COLUMNS,
  isKanbanColumn,
  type KanbanColumn,
  type KanbanDoneScope,
  type KanbanFilterMode,
} from "../types/kanban";
import { toJstDateString, todayJst } from "../utils/date";

export type { KanbanDoneScope, KanbanFilterMode } from "../types/kanban";

export interface BacklogKanbanCard {
  kind: "backlog";
  issue: BacklogIssue;
  column: KanbanColumn;
}

export interface LocalKanbanCard {
  kind: "local";
  task: LocalTask;
  column: KanbanColumn;
}

export type KanbanCard = BacklogKanbanCard | LocalKanbanCard;

export type KanbanBoard = Record<KanbanColumn, KanbanCard[]>;

function emptyBoard(): KanbanBoard {
  return KANBAN_COLUMNS.reduce<KanbanBoard>(
    (acc, col) => {
      acc[col] = [];
      return acc;
    },
    {} as KanbanBoard,
  );
}

function buildBacklogMappingLookup(): Map<number, Map<number, KanbanColumn>> {
  // projectId → (statusId → kanbanColumn)
  const settings = getAppSettings();
  const result = new Map<number, Map<number, KanbanColumn>>();
  for (const p of settings.kanban.projects) {
    const inner = new Map<number, KanbanColumn>();
    for (const [statusIdStr, col] of Object.entries(p.columnByStatusId)) {
      if (!isKanbanColumn(col)) continue;
      const sid = Number(statusIdStr);
      if (!Number.isFinite(sid)) continue;
      inner.set(sid, col);
    }
    result.set(p.projectId, inner);
  }
  return result;
}

function getBacklogIssues(mode: KanbanFilterMode, today: string): BacklogIssue[] {
  const settings = getAppSettings();
  const selfUserId = settings.backlog.self?.userId;
  if (mode === "today") {
    return findToday(today, selfUserId);
  }
  return findAll({ requireAssigned: !!selfUserId, assigneeIds: selfUserId ? [selfUserId] : undefined });
}

function getLocalTasksForMode(_mode: KanbanFilterMode, _today: string): LocalTask[] {
  // ローカルメモタスクは Backlog と異なり「今日着手フラグ」を持たないため、
  // ローカル分は「今日」/「担当全件」どちらのモードでも全件表示する。
  // 期限による絞り込みは行わない (新規登録時に未来期限を付けても見失わないようにするため)。
  return listLocalTasks(true);
}

export function getKanbanBoard(
  mode: KanbanFilterMode = "today",
  doneScope: KanbanDoneScope = "today",
  today: string = todayJst(),
): KanbanBoard {
  const board = emptyBoard();
  const mapping = buildBacklogMappingLookup();

  for (const issue of getBacklogIssues(mode, today)) {
    const inner = mapping.get(issue.projectId);
    const col = inner?.get(issue.status.id);
    if (!col) continue; // マッピング未設定なら表示しない
    board[col].push({ kind: "backlog", issue, column: col });
  }

  for (const task of getLocalTasksForMode(mode, today)) {
    board[task.status].push({ kind: "local", task, column: task.status });
  }

  // 列内ソート: 期限昇順、なしは末尾、更新降順 (done 列を除く)
  for (const col of KANBAN_COLUMNS) {
    if (col === "done") continue;
    board[col].sort((a, b) => {
      const aDue = cardDue(a) ?? "9999-99-99";
      const bDue = cardDue(b) ?? "9999-99-99";
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return cardUpdated(b).localeCompare(cardUpdated(a));
    });
  }

  // done 列は「完了時刻 (Local: completedAt / Backlog: updatedAt) 降順」でソート
  board.done.sort((a, b) => cardCompletionTs(b).localeCompare(cardCompletionTs(a)));
  board.done = filterDoneByScope(board.done, doneScope, today);

  return board;
}

function filterDoneByScope(
  cards: KanbanCard[],
  scope: KanbanDoneScope,
  today: string,
): KanbanCard[] {
  switch (scope) {
    case "all":
      return cards;
    case "10":
      return cards.slice(0, 10);
    case "20":
      return cards.slice(0, 20);
    case "today":
      // JST 基準で「完了時刻の JST 日付 == JST today」のもの
      return cards.filter((c) => toJstDateString(cardCompletionTs(c)) === today);
  }
}

function cardDue(card: KanbanCard): string | undefined {
  return card.kind === "backlog" ? card.issue.dueDate : card.task.dueDate;
}

function cardUpdated(card: KanbanCard): string {
  return card.kind === "backlog" ? card.issue.updatedAt : card.task.updatedAt;
}

/** done 列の完了時刻基準。Local は completedAt、Backlog は updatedAt をプロキシとして使う。 */
function cardCompletionTs(card: KanbanCard): string {
  if (card.kind === "local") return card.task.completedAt ?? card.task.updatedAt;
  return card.issue.updatedAt;
}

/**
 * あるカンバン列に対して、指定の Backlog プロジェクトでマップされている Backlog ステータス候補を返す。
 * D&D 時の確認モーダルで「どの Backlog ステータスに遷移するか」を選ばせるのに使う。
 */
export function getBacklogStatusCandidatesForColumn(
  projectId: number,
  column: KanbanColumn,
): number[] {
  const settings = getAppSettings();
  const proj = settings.kanban.projects.find((p) => p.projectId === projectId);
  if (!proj) return [];
  return Object.entries(proj.columnByStatusId)
    .filter(([, col]) => col === column)
    .map(([sid]) => Number(sid))
    .filter((n) => Number.isFinite(n));
}
