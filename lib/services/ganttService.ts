// lib/services/ganttService.ts
import type { BacklogIssue } from "../types/backlog";
import type { LocalTask } from "../types/localTask";
import type { BacklogProjectSetting } from "../types/settings";
import type { GanttBarState, GanttGroup, GanttModel, GanttRow } from "../types/gantt";
import { todayJst } from "../utils/date";

export const GANTT_PAST_DAYS = 3;
export const GANTT_FUTURE_DAYS = 14;
export const GANTT_DAYS = GANTT_PAST_DAYS + 1 + GANTT_FUTURE_DAYS; // 18
export const TODAY_COL = GANTT_PAST_DAYS + 1; // 4
export const LOCAL_GROUP_NAME = "ローカルタスク";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD を UTC 0 時の epoch ms に変換。不正なら NaN */
function dayMs(d: string): number {
  return Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
}

/** from→to の日数差（整数日, 切り捨て）。不正入力は 0 */
function diffDays(from: string, to: string): number {
  const a = dayMs(from);
  const b = dayMs(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / MS_PER_DAY);
}

/** date に n 日加算した YYYY-MM-DD を返す */
function addDays(date: string, n: number): string {
  const base = dayMs(date);
  return new Date(base + n * MS_PER_DAY).toISOString().slice(0, 10);
}

interface BarPlacement {
  barState: GanttBarState;
  startCol: number;
  span: number;
  clipLeft: boolean;
  clipRight: boolean;
  daysOverdue: number;
}

/**
 * 期限日と今日から、ガントの帯の配置（列・スパン・クリップ）を算出する純粋関数。
 * 横軸は today-3日（列1）〜 today+14日（列18）。今日は列 TODAY_COL。
 */
export function computeBar(due: string | undefined | null, today: string = todayJst()): BarPlacement {
  if (!due) {
    return { barState: "none", startCol: 0, span: 0, clipLeft: false, clipRight: false, daysOverdue: 0 };
  }
  const d = due.slice(0, 10);
  const startDate = addDays(today, -GANTT_PAST_DAYS); // 列1の日付
  const dueColRaw = diffDays(startDate, d) + 1; // 1始まりの未クランプ列

  if (d >= today) {
    // 通常: 今日列から期限列まで
    const endRaw = dueColRaw;
    const clipRight = endRaw > GANTT_DAYS;
    const endCol = Math.min(endRaw, GANTT_DAYS);
    const span = Math.max(1, endCol - TODAY_COL + 1);
    return { barState: "normal", startCol: TODAY_COL, span, clipLeft: false, clipRight, daysOverdue: 0 };
  }

  // overdue: 期限列から今日列まで
  const clipLeft = dueColRaw < 1;
  const startCol = Math.max(1, dueColRaw);
  const span = Math.max(1, TODAY_COL - startCol + 1);
  const daysOverdue = diffDays(d, today);
  return { barState: "overdue", startCol, span, clipLeft, clipRight: false, daysOverdue };
}

function projectName(projectId: number, projects: BacklogProjectSetting[]): string {
  const p = projects.find((x) => x.projectId === projectId);
  return p?.name || p?.projectKey || `プロジェクト #${projectId}`;
}

function toRow(
  id: string,
  kind: "backlog" | "local",
  title: string,
  due: string | undefined,
  today: string,
  key?: string,
): GanttRow {
  const bar = computeBar(due, today);
  return {
    id,
    kind,
    title,
    key,
    dueDate: due ? due.slice(0, 10) : undefined,
    barState: bar.barState,
    startCol: bar.startCol,
    span: bar.span,
    clipLeft: bar.clipLeft,
    clipRight: bar.clipRight,
    daysOverdue: bar.daysOverdue,
  };
}

function byDueAsc(a: GanttRow, b: GanttRow): number {
  return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
}

/**
 * Backlog チケットとローカルタスクからガント描画モデルを構築する純粋関数。
 * - 期限ありはプロジェクト（ローカルは専用グループ）に分類し期限昇順。
 * - 期限なしは undated に振り分け。
 * - 完了済みローカルタスクは防御的に除外。
 */
export function buildGanttRows(
  issues: BacklogIssue[],
  localTasks: LocalTask[],
  projects: BacklogProjectSetting[],
  today: string = todayJst(),
): GanttModel {
  const startDate = addDays(today, -GANTT_PAST_DAYS);
  const days = Array.from({ length: GANTT_DAYS }, (_, i) => addDays(startDate, i));

  const undated: GanttRow[] = [];
  // プロジェクト ID → グループ（settings の並び順を尊重するため Map で順序保持）
  const groupMap = new Map<string, GanttRow[]>();
  const ensureGroup = (name: string): GanttRow[] => {
    let arr = groupMap.get(name);
    if (!arr) {
      arr = [];
      groupMap.set(name, arr);
    }
    return arr;
  };

  // settings の順でプロジェクトグループを先に確保（空グループは後段で除外）
  for (const p of projects) {
    ensureGroup(projectName(p.projectId, projects));
  }

  for (const issue of issues) {
    const row = toRow(`backlog-${issue.id}`, "backlog", issue.summary, issue.dueDate, today, issue.issueKey);
    if (row.barState === "none") {
      undated.push(row);
    } else {
      ensureGroup(projectName(issue.projectId, projects)).push(row);
    }
  }

  for (const task of localTasks) {
    if (task.status === "done") continue; // 防御的に完了除外
    const row = toRow(`local-${task.id}`, "local", task.title, task.dueDate, today);
    if (row.barState === "none") {
      undated.push(row);
    } else {
      ensureGroup(LOCAL_GROUP_NAME).push(row);
    }
  }

  const groups: GanttGroup[] = [];
  for (const [groupName, rows] of groupMap) {
    if (groupName === LOCAL_GROUP_NAME) continue; // ローカルは最後に回す
    if (rows.length === 0) continue;
    groups.push({ groupName, rows: [...rows].sort(byDueAsc) });
  }
  const localRows = groupMap.get(LOCAL_GROUP_NAME);
  if (localRows && localRows.length > 0) {
    groups.push({ groupName: LOCAL_GROUP_NAME, rows: [...localRows].sort(byDueAsc) });
  }

  return { days, groups, undated: [...undated].sort(byDueAsc) };
}
