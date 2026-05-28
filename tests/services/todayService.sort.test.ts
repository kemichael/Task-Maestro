// このテストは getTodayList のソート挙動を検証するが、現状のサービスは DB と密結合のため、
// 純粋関数として切り出すまではモック方針で検証する。
// ここでは将来のリファクタ用にソート規則の expected を文書化する位置付け。
import { describe, expect, it } from "vitest";
import type { BacklogIssue } from "@/lib/types/backlog";

function priorityRank(priority?: BacklogIssue["priority"]): number {
  if (!priority) return 4;
  const map: Record<string, number> = { 高: 1, 中: 2, 低: 3, High: 1, Normal: 2, Low: 3 };
  return map[priority.name] ?? 4;
}

function sort(issues: BacklogIssue[]): BacklogIssue[] {
  return [...issues].sort((a, b) => {
    const aDue = a.dueDate ?? "9999-99-99";
    const bDue = b.dueDate ?? "9999-99-99";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

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

describe("today list sort", () => {
  it("期限の早い順、期限なしは末尾", () => {
    const issues = [
      mkIssue({ id: 1, issueKey: "A-1", summary: "a", dueDate: "2026-06-01" }),
      mkIssue({ id: 2, issueKey: "A-2", summary: "b" }),
      mkIssue({ id: 3, issueKey: "A-3", summary: "c", dueDate: "2026-05-30" }),
    ];
    const sorted = sort(issues);
    expect(sorted.map((i) => i.id)).toEqual([3, 1, 2]);
  });

  it("期限同じなら優先度高い順", () => {
    const issues = [
      mkIssue({
        id: 1,
        issueKey: "A-1",
        summary: "a",
        dueDate: "2026-06-01",
        priority: { id: 3, name: "中" },
      }),
      mkIssue({
        id: 2,
        issueKey: "A-2",
        summary: "b",
        dueDate: "2026-06-01",
        priority: { id: 2, name: "高" },
      }),
    ];
    const sorted = sort(issues);
    expect(sorted.map((i) => i.id)).toEqual([2, 1]);
  });

  it("期限・優先度同じなら updatedAt 降順", () => {
    const issues = [
      mkIssue({
        id: 1,
        issueKey: "A-1",
        summary: "a",
        dueDate: "2026-06-01",
        priority: { id: 3, name: "中" },
        updatedAt: "2026-05-20T00:00:00Z",
      }),
      mkIssue({
        id: 2,
        issueKey: "A-2",
        summary: "b",
        dueDate: "2026-06-01",
        priority: { id: 3, name: "中" },
        updatedAt: "2026-05-25T00:00:00Z",
      }),
    ];
    const sorted = sort(issues);
    expect(sorted.map((i) => i.id)).toEqual([2, 1]);
  });
});
