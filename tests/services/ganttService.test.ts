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
    expect(bar.clipLeft).toBe(false);
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

  it("projects が空でも #id でグループ化できる", () => {
    const issues = [mkIssue({ id: 1, issueKey: "X-1", summary: "x", projectId: 99, dueDate: "2026-06-12" })];
    const model = buildGanttRows(issues, [], [], TODAY);
    expect(model.groups.some((g) => g.groupName === "プロジェクト #99")).toBe(true);
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
