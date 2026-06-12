# ガントチャートタブ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backlog チケットとローカルタスクの期限を時間軸で俯瞰するガントチャートタブ（`/gantt`）を追加する。

**Architecture:** Server Component（`app/gantt/page.tsx`）が既存サービスからデータを取得し、純粋関数 `buildGanttRows`（`lib/services/ganttService.ts`）でガント描画モデルへ変換、Client Component（`components/GanttChart.tsx`）が CSS Grid（18 列）で帯を描画する。日付・配置計算は純粋関数に集約し vitest で検証する。

**Tech Stack:** Next.js (App Router), TypeScript, CSS Grid（既存サイバーテーマ）, vitest。

参照スペック: `docs/superpowers/specs/2026-06-11-gantt-chart-tab-design.md`

---

## File Structure

- Create: `lib/types/gantt.ts` — ガント描画モデルの型定義。
- Create: `lib/services/ganttService.ts` — `buildGanttRows` / `computeBar` 純粋関数とタイムライン定数。
- Create: `tests/services/ganttService.test.ts` — 純粋関数の単体テスト。
- Create: `components/GanttChart.tsx` — CSS Grid タイムライン描画（Client Component）。
- Create: `app/gantt/page.tsx` — データ取得 Server Component。
- Modify: `app/layout.tsx` — ナビに「ガント」リンク追加。
- Modify: `app/globals.css` — ガント用スタイル追記。

---

### Task 1: ガント描画モデルの型定義

**Files:**
- Create: `lib/types/gantt.ts`

- [ ] **Step 1: 型定義ファイルを作成**

```ts
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
```

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: PASS（新規型はまだ未使用だがコンパイル可能）

- [ ] **Step 3: コミット**

```bash
git add lib/types/gantt.ts
git commit -m "feat: ガント描画モデルの型を追加"
```

---

### Task 2: buildGanttRows / computeBar 純粋関数（TDD）

**Files:**
- Create: `tests/services/ganttService.test.ts`
- Create: `lib/services/ganttService.ts`

タイムライン定数: `GANTT_PAST_DAYS = 3`, `GANTT_FUTURE_DAYS = 14`, `GANTT_DAYS = 18`, `TODAY_COL = 4`。
列計算は基準日 `startDate = today - 3日` を列 1 とし、`colOf(date) = diffDays(startDate, date) + 1`。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/services/ganttService.test.ts
import { describe, expect, it } from "vitest";
import { buildGanttRows, computeBar, GANTT_DAYS, TODAY_COL } from "@/lib/services/ganttService";
import type { BacklogIssue } from "@/lib/types/backlog";
import type { LocalTask } from "@/lib/types/localTask";
import type { BacklogProjectSetting } from "@/lib/types/settings";

const TODAY = "2026-06-11";

function mkIssue(
  partial: Partial<BacklogIssue> & Pick<BacklogIssue, "id" | "issueKey" | "summary">,
): BacklogIssue {
  return {
    projectId: 1,
    status: { id: 1, name: "未対応" },
    todayFlag: false,
    updatedAt: "2026-05-28T00:00:00Z",
    ...partial,
  } as BacklogIssue;
}

function mkLocal(partial: Partial<LocalTask> & Pick<LocalTask, "id" | "title">): LocalTask {
  return {
    status: "todo",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    ...partial,
  } as LocalTask;
}

describe("computeBar", () => {
  it("期限=今日 は今日列に1セル帯", () => {
    const bar = computeBar(TODAY, TODAY);
    expect(bar.barState).toBe("normal");
    expect(bar.startCol).toBe(TODAY_COL);
    expect(bar.span).toBe(1);
    expect(bar.clipRight).toBe(false);
  });

  it("期限=今日+5 は今日列から6セル帯", () => {
    const bar = computeBar("2026-06-16", TODAY);
    expect(bar.startCol).toBe(TODAY_COL);
    expect(bar.span).toBe(6); // 今日〜期限（両端含む）
    expect(bar.clipRight).toBe(false);
  });

  it("期限=今日+14 は右端ぴったり（クリップなし）", () => {
    const bar = computeBar("2026-06-25", TODAY);
    expect(bar.startCol).toBe(TODAY_COL);
    expect(bar.span).toBe(GANTT_DAYS - TODAY_COL + 1); // 15
    expect(bar.clipRight).toBe(false);
  });

  it("期限>今日+14 は右端でクリップ", () => {
    const bar = computeBar("2026-07-01", TODAY);
    expect(bar.startCol).toBe(TODAY_COL);
    expect(bar.span).toBe(GANTT_DAYS - TODAY_COL + 1); // 15（列18まで）
    expect(bar.clipRight).toBe(true);
  });

  it("overdue（2日前）は期限〜今日の実区間赤帯", () => {
    const bar = computeBar("2026-06-09", TODAY);
    expect(bar.barState).toBe("overdue");
    expect(bar.startCol).toBe(TODAY_COL - 2); // 列2
    expect(bar.span).toBe(3); // 列2,3,4
    expect(bar.clipLeft).toBe(false);
    expect(bar.daysOverdue).toBe(2);
  });

  it("overdue（3日より古い）は左端クランプ＋clipLeft", () => {
    const bar = computeBar("2026-06-01", TODAY);
    expect(bar.barState).toBe("overdue");
    expect(bar.startCol).toBe(1);
    expect(bar.span).toBe(TODAY_COL); // 列1..4 = 4
    expect(bar.clipLeft).toBe(true);
    expect(bar.daysOverdue).toBe(10);
  });

  it("期限なしは none", () => {
    const bar = computeBar(undefined, TODAY);
    expect(bar.barState).toBe("none");
  });
});

describe("buildGanttRows", () => {
  const projects: BacklogProjectSetting[] = [
    { projectId: 10, name: "PROJECT_A" },
    { projectId: 20, projectKey: "PRJB" },
  ];

  it("days は18日分で先頭が今日-3日", () => {
    const model = buildGanttRows([], [], projects, TODAY);
    expect(model.days).toHaveLength(GANTT_DAYS);
    expect(model.days[0]).toBe("2026-06-08");
    expect(model.days[TODAY_COL - 1]).toBe(TODAY);
    expect(model.days[GANTT_DAYS - 1]).toBe("2026-06-25");
  });

  it("Backlog はプロジェクトごとにグループ化し期限昇順", () => {
    const issues = [
      mkIssue({ id: 1, issueKey: "PROJECT_A-2", summary: "後", projectId: 10, dueDate: "2026-06-20" }),
      mkIssue({ id: 2, issueKey: "PROJECT_A-1", summary: "先", projectId: 10, dueDate: "2026-06-12" }),
    ];
    const model = buildGanttRows(issues, [], projects, TODAY);
    const groupA = model.groups.find((g) => g.groupName === "PROJECT_A");
    expect(groupA?.rows.map((r) => r.title)).toEqual(["先", "後"]);
  });

  it("ローカルタスクは最後の専用グループ", () => {
    const issues = [mkIssue({ id: 1, issueKey: "PROJECT_A-1", summary: "a", projectId: 10, dueDate: "2026-06-12" })];
    const locals = [mkLocal({ id: 1, title: "メモ", dueDate: "2026-06-13" })];
    const model = buildGanttRows(issues, locals, projects, TODAY);
    expect(model.groups[model.groups.length - 1].groupName).toBe("ローカルタスク");
  });

  it("プロジェクト名が未登録なら projectKey→#id でフォールバック", () => {
    const issues = [mkIssue({ id: 1, issueKey: "PRJB-1", summary: "b", projectId: 20, dueDate: "2026-06-12" })];
    const model = buildGanttRows(issues, [], projects, TODAY);
    expect(model.groups.some((g) => g.groupName === "PRJB")).toBe(true);
  });

  it("完了済みローカルタスクは除外（呼び出し側で未完了のみ渡す前提でも防御）", () => {
    const locals = [mkLocal({ id: 1, title: "done", dueDate: "2026-06-12", status: "done" })];
    const model = buildGanttRows([], locals, projects, TODAY);
    expect(model.groups.length).toBe(0);
    expect(model.undated.length).toBe(0);
  });

  it("期限なしは undated へ振り分け", () => {
    const issues = [mkIssue({ id: 1, issueKey: "PROJECT_A-1", summary: "未定", projectId: 10 })];
    const model = buildGanttRows(issues, [], projects, TODAY);
    expect(model.groups.length).toBe(0);
    expect(model.undated.map((r) => r.title)).toEqual(["未定"]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/services/ganttService.test.ts`
Expected: FAIL（`ganttService` モジュール未作成で import エラー）

- [ ] **Step 3: 最小実装を書く**

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/services/ganttService.test.ts`
Expected: PASS（全ケース green）

- [ ] **Step 5: 型チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add lib/services/ganttService.ts tests/services/ganttService.test.ts
git commit -m "feat: ガント描画モデル構築 buildGanttRows を追加"
```

---

### Task 3: GanttChart コンポーネント

**Files:**
- Create: `components/GanttChart.tsx`

- [ ] **Step 1: コンポーネントを作成**

```tsx
// components/GanttChart.tsx
"use client";

import { GANTT_DAYS, TODAY_COL } from "@/lib/services/ganttService";
import type { GanttModel, GanttRow } from "@/lib/types/gantt";

/** YYYY-MM-DD → "M/D" */
function shortDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}

/** 0=日, 6=土 を返す（UTC 0 時基準で判定） */
function weekday(d: string): number {
  return new Date(`${d}T00:00:00Z`).getUTCDay();
}

function Bar({ row }: { row: GanttRow }) {
  if (row.barState === "none") return null;
  return (
    <div
      className={`gantt-bar gantt-bar--${row.barState}`}
      style={{ gridColumn: `${row.startCol} / span ${row.span}` }}
      title={
        row.barState === "overdue"
          ? `期限 ${row.dueDate}（${row.daysOverdue}日超過）`
          : `期限 ${row.dueDate}`
      }
    >
      {row.clipLeft && <span className="gantt-clip gantt-clip--left">◂</span>}
      <span className="gantt-bar-label">
        {row.barState === "overdue" ? `${row.daysOverdue}日超過` : ""}
      </span>
      {row.clipRight && <span className="gantt-clip gantt-clip--right">▸</span>}
    </div>
  );
}

export function GanttChart({ model }: { model: GanttModel }) {
  const hasRows = model.groups.length > 0;
  const gridTemplate = `repeat(${GANTT_DAYS}, minmax(28px, 1fr))`;

  return (
    <div className="gantt">
      {/* 横軸ヘッダー */}
      <div className="gantt-row gantt-row--header">
        <div className="gantt-label gantt-label--header" />
        <div className="gantt-timeline" style={{ gridTemplateColumns: gridTemplate }}>
          {model.days.map((d, i) => {
            const wd = weekday(d);
            const isToday = i === TODAY_COL - 1;
            const isPast = i < TODAY_COL - 1;
            const cls = [
              "gantt-day",
              isToday ? "gantt-day--today" : "",
              isPast ? "gantt-day--past" : "",
              wd === 0 || wd === 6 ? "gantt-day--weekend" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={d} className={cls}>
                {shortDate(d)}
              </div>
            );
          })}
        </div>
      </div>

      {/* グループ + 行 */}
      {!hasRows && <p className="gantt-empty">表示できる予定がありません。</p>}
      {model.groups.map((group) => (
        <div key={group.groupName} className="gantt-group">
          <div className="gantt-group-head">▸ {group.groupName}</div>
          {group.rows.map((row) => (
            <div key={row.id} className="gantt-row">
              <div className="gantt-label" title={row.title}>
                {row.key && <span className="gantt-key">{row.key}</span>}
                <span className="gantt-title">{row.title}</span>
              </div>
              <div className="gantt-timeline" style={{ gridTemplateColumns: gridTemplate }}>
                <Bar row={row} />
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* 期限未設定リスト */}
      {model.undated.length > 0 && (
        <div className="gantt-undated">
          <div className="gantt-undated-head">⚠ 期限未設定</div>
          <ul>
            {model.undated.map((row) => (
              <li key={row.id}>
                {row.key && <span className="gantt-key">{row.key}</span>}
                <span className="gantt-title">{row.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add components/GanttChart.tsx
git commit -m "feat: ガントチャート描画コンポーネント GanttChart を追加"
```

---

### Task 4: gantt ページ + ナビリンク

**Files:**
- Create: `app/gantt/page.tsx`
- Modify: `app/layout.tsx`（nav にリンク追加）

- [ ] **Step 1: ページを作成**

```tsx
// app/gantt/page.tsx
import { getEnvStatus } from "@/lib/env";
import { getAppSettings } from "@/lib/db/settingsRepository";
import { listLocalIssues } from "@/lib/services/backlogIssueService";
import { getLocalTasksForToday } from "@/lib/services/localTaskService";
import { buildGanttRows } from "@/lib/services/ganttService";
import { GanttChart } from "@/components/GanttChart";
import { SyncButton } from "@/components/SyncButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GanttPage() {
  const envStatuses = getEnvStatus();
  const missingRequired = envStatuses.filter((s) => s.required && s.status !== "ok");

  if (missingRequired.length > 0) {
    return (
      <div>
        <h1>ガントチャート</h1>
        <div className="error-banner">
          必須の環境変数が未設定です: {missingRequired.map((s) => s.key).join(", ")}
          <br />
          <Link href="/settings">設定画面</Link> で詳細を確認し、`.env.local` を編集してください。
        </div>
      </div>
    );
  }

  const settings = getAppSettings();
  const issues = listLocalIssues();
  const localTasks = getLocalTasksForToday();
  const model = buildGanttRows(issues, localTasks, settings.backlog.projects);

  return (
    <div>
      <div className="page-header">
        <h1>ガントチャート</h1>
        <div className="page-actions">
          <SyncButton />
        </div>
      </div>
      <GanttChart model={model} />
    </div>
  );
}
```

- [ ] **Step 2: ナビにリンクを追加**

`app/layout.tsx` の `<nav className="nav">` 内、`カンバン` リンクの直後に追加する:

```tsx
            <Link href="/">ダッシュボード</Link>
            <Link href="/kanban">カンバン</Link>
            <Link href="/gantt">ガント</Link>
            <Link href="/issues">チケット一覧</Link>
            <Link href="/manual">マニュアル</Link>
            <Link href="/settings">設定</Link>
```

- [ ] **Step 3: 型チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add app/gantt/page.tsx app/layout.tsx
git commit -m "feat: ガントチャートページとナビリンクを追加"
```

---

### Task 5: ガント用スタイル

**Files:**
- Modify: `app/globals.css`（末尾に追記）

- [ ] **Step 1: スタイルを追記**

`app/globals.css` の末尾に以下を追記する。既存テーマトークン（`--color-accent` など）を流用する:

```css
/* ===== ガントチャート ===== */
.gantt {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow-x: auto;
}
.gantt-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
}
.gantt-row--header {
  position: sticky;
  top: 0;
  background: var(--color-surface-alt);
  z-index: 1;
}
.gantt-label {
  padding: 6px 10px;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-right: 1px solid var(--color-border);
}
.gantt-label--header {
  border-right: 1px solid var(--color-border);
}
.gantt-key {
  color: var(--color-cyan);
  font-family: var(--font-mono-google), monospace;
  margin-right: 6px;
  font-size: 11px;
}
.gantt-title {
  color: var(--color-text);
}
.gantt-timeline {
  display: grid;
  position: relative;
  min-height: 28px;
  align-items: center;
}
.gantt-day {
  text-align: center;
  font-size: 10px;
  color: var(--color-text-muted);
  padding: 4px 0;
  border-left: 1px solid var(--color-border);
}
.gantt-day--past {
  color: var(--color-text-subtle);
  background: var(--color-surface-muted);
}
.gantt-day--weekend {
  background: var(--color-surface-muted);
}
.gantt-day--today {
  color: var(--color-text-on-yellow);
  background: var(--color-accent);
  font-weight: 600;
}
.gantt-bar {
  height: 16px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  overflow: hidden;
  position: relative;
}
.gantt-bar--normal {
  background: var(--color-accent);
  color: var(--color-text-on-yellow);
}
.gantt-bar--overdue {
  background: var(--color-magenta);
  color: #fff;
}
.gantt-bar-label {
  white-space: nowrap;
  padding: 0 4px;
}
.gantt-clip {
  font-size: 10px;
  line-height: 1;
}
.gantt-group-head {
  padding: 6px 10px;
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--color-accent);
  background: var(--color-surface-alt);
  border-bottom: 1px solid var(--color-border);
}
.gantt-empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
}
.gantt-undated {
  padding: 10px 12px;
  border-top: 1px solid var(--color-border-strong);
}
.gantt-undated-head {
  font-size: 12px;
  color: var(--color-orange-warn);
  margin-bottom: 6px;
}
.gantt-undated ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
}
.gantt-undated li {
  font-size: 12px;
}
```

- [ ] **Step 2: ビルドして全体が通ることを確認**

Run: `npm run build`
Expected: PASS（`/gantt` を含むビルド成功）

- [ ] **Step 3: 開発サーバで目視確認**

Run: `npm run dev` → ブラウザで `http://localhost:3000/gantt` を開く。
Expected:
- ナビに「ガント」が表示され、クリックで遷移できる。
- 横軸が 18 日（過去3＋今日＋14）で、今日列がイエローでハイライト。
- 期限ありの Backlog/ローカルタスクが帯で表示され、overdue が赤帯。
- 期限なしが下部「⚠ 期限未設定」に列挙される。

- [ ] **Step 4: コミット**

```bash
git add app/globals.css
git commit -m "feat: ガントチャートのスタイルを追加"
```

---

## Self-Review

- **Spec coverage:**
  - 横軸 18 日 / 今日列ハイライト → Task 2（days 生成）, Task 3（ヘッダー）, Task 5（today 強調）。
  - 今日〜期限イエロー帯 / overdue 赤帯 / クリップ → Task 2（computeBar）, Task 3（Bar）, Task 5（色）。
  - プロジェクトグループ → ローカル最後 / 期限昇順 → Task 2（buildGanttRows）。
  - 期限なしリスト → Task 2（undated）, Task 3（undated 描画）, Task 5（スタイル）。
  - プロジェクト名フォールバック → Task 2（projectName）。
  - 完了ローカル除外 → Task 2。
  - ナビタブ追加 → Task 4。
  - テスト → Task 2。
  - 全要件にタスクが対応。
- **Placeholder scan:** プレースホルダなし。各コード step は完全なコードを含む。
- **Type consistency:** `GanttModel`/`GanttRow`/`GanttGroup`（Task 1）を Task 2/3 で一貫使用。`computeBar`/`buildGanttRows`/`GANTT_DAYS`/`TODAY_COL` の名前は Task 2 定義と Task 3 利用で一致。`BacklogProjectSetting`（既存 settings.ts）, `LocalTask.status`（既存）と整合。
