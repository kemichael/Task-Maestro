export const KANBAN_COLUMNS = ["todo", "in_progress", "resolved", "done"] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

export const KANBAN_COLUMN_LABEL: Record<KanbanColumn, string> = {
  todo: "未対応",
  in_progress: "処理中",
  resolved: "処理済み",
  done: "完了",
};

export function isKanbanColumn(value: unknown): value is KanbanColumn {
  return typeof value === "string" && (KANBAN_COLUMNS as readonly string[]).includes(value);
}

/** ローカルタスクの status (= カンバン列ID と同じ語彙) */
export type LocalTaskStatus = KanbanColumn;

export type KanbanFilterMode = "today" | "assigned";

export const DONE_SCOPES = ["today", "10", "20", "all"] as const;
export type KanbanDoneScope = (typeof DONE_SCOPES)[number];

export const DONE_SCOPE_LABEL: Record<KanbanDoneScope, string> = {
  today: "当日完了分",
  "10": "最新 10 件",
  "20": "最新 20 件",
  all: "全件",
};

export function isDoneScope(value: unknown): value is KanbanDoneScope {
  return typeof value === "string" && (DONE_SCOPES as readonly string[]).includes(value);
}

/** デフォルト推定: Backlog 標準ステータス ID (1: 未対応, 2: 処理中, 3: 処理済み, 4: 完了) */
export function defaultColumnForBacklogStatusId(statusId: number): KanbanColumn | undefined {
  switch (statusId) {
    case 1:
      return "todo";
    case 2:
      return "in_progress";
    case 3:
      return "resolved";
    case 4:
      return "done";
    default:
      return undefined;
  }
}
