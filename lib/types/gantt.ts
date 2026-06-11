// lib/types/gantt.ts

/** 帯の状態。normal=今日〜期限, overdue=期限〜今日, none=期限未設定 */
export type GanttBarState = "normal" | "overdue" | "none";

export interface GanttRow {
  /** 一意キー。"backlog-<id>" / "local-<id>" */
  id: string;
  kind: "backlog" | "local";
  title: string;
  /** Backlog issueKey（例: "PROJ-12"）。ローカルタスクは undefined */
  key?: string;
  /** YYYY-MM-DD（正規化済み）。期限なしは undefined */
  dueDate?: string;
  barState: GanttBarState;
  /** CSS Grid 列開始（1 始まり, 1..GANTT_DAYS）。barState==="none" では未使用 */
  startCol: number;
  /** 列スパン（>=1）。barState==="none" では未使用 */
  span: number;
  /** 帯が過去側（範囲外）から続く（◂ マーカー） */
  clipLeft: boolean;
  /** 帯が未来側（範囲外）へ続く（▸ マーカー） */
  clipRight: boolean;
  /** overdue の超過日数（normal/none では 0） */
  daysOverdue: number;
}

export interface GanttGroup {
  /** プロジェクト名 or "ローカルタスク" */
  groupName: string;
  /** 期限日昇順の行 */
  rows: GanttRow[];
}

export interface GanttModel {
  /** 横軸ラベル用の YYYY-MM-DD × GANTT_DAYS（過去 3 日 + 今日 + 14 日先） */
  days: string[];
  /** 帯を持つ行のグループ（プロジェクト群 → ローカル） */
  groups: GanttGroup[];
  /** 期限未設定の行（下部リスト用） */
  undated: GanttRow[];
}
