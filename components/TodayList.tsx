"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BacklogIssue } from "@/lib/types/backlog";
import type { BacklogProjectSetting } from "@/lib/types/settings";
import { isCompletedStatus } from "@/lib/utils/issueStatus";

interface ParentRef {
  id: number;
  issueKey: string;
  name: string;
}

interface Props {
  issues: BacklogIssue[];
  projects?: BacklogProjectSetting[];
  parentMap?: Record<number, ParentRef>;
}

type SortKey = "due" | "priority" | "updated";
type SortOrder = "asc" | "desc";

function priorityRank(priority?: BacklogIssue["priority"]): number {
  if (!priority) return 99;
  const map: Record<string, number> = { 高: 1, 中: 2, 低: 3, High: 1, Normal: 2, Low: 3 };
  return map[priority.name] ?? 99;
}

function compareIssues(a: BacklogIssue, b: BacklogIssue, key: SortKey, order: SortOrder): number {
  const sign = order === "asc" ? 1 : -1;
  switch (key) {
    case "due": {
      const av = a.dueDate ?? "9999-99-99";
      const bv = b.dueDate ?? "9999-99-99";
      return av.localeCompare(bv) * sign;
    }
    case "priority":
      return (priorityRank(a.priority) - priorityRank(b.priority)) * sign;
    case "updated":
      return a.updatedAt.localeCompare(b.updatedAt) * sign;
  }
}

export function TodayList({ issues, projects = [], parentMap = {} }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<number | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [keyword, setKeyword] = useState("");
  const [projectFilter, setProjectFilter] = useState<number | "">("");

  // 設定にプロジェクト名がない場合は一覧から派生
  const projectOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of projects) {
      const label = p.name ?? p.projectKey ?? `Project ${p.projectId}`;
      map.set(p.projectId, label);
    }
    for (const i of issues) {
      if (!map.has(i.projectId)) {
        map.set(i.projectId, i.issueKey.split("-")[0] ?? `Project ${i.projectId}`);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [issues, projects]);

  const sorted = useMemo(() => {
    return issues
      .filter((i) => {
        if (projectFilter !== "" && i.projectId !== projectFilter) return false;
        if (keyword) {
          const k = keyword.toLowerCase();
          if (
            !i.summary.toLowerCase().includes(k) &&
            !i.issueKey.toLowerCase().includes(k)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => compareIssues(a, b, sortKey, sortOrder));
  }, [issues, sortKey, sortOrder, keyword, projectFilter]);

  const handleCheck = (issueId: number) => {
    setError(null);
    setChecking(issueId);
    startTransition(async () => {
      const res = await fetch(`/api/today/${issueId}/start`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `エラー (${res.status})`);
      } else {
        router.refresh();
      }
      setChecking(null);
    });
  };

  const handleFlagToggle = (issueId: number, current: boolean) => {
    startTransition(async () => {
      await fetch(`/api/today/${issueId}/flag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: !current }),
      });
      router.refresh();
    });
  };

  if (issues.length === 0) {
    return (
      <div className="today-empty">
        今日やるタスクはありません。
        <br />
        チケット一覧から「今日やる」フラグを立てるか、Backlog の期限を本日以前に設定してください。
      </div>
    );
  }

  return (
    <div className="today-list">
      <div className="today-controls">
        <input
          type="text"
          placeholder="キーワード"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="today-search"
        />
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : "")}
          title="プロジェクトで絞り込み"
        >
          <option value="">全プロジェクト</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="due">期限順</option>
          <option value="priority">優先度順</option>
          <option value="updated">更新日順</option>
        </select>
        <button
          type="button"
          className="secondary-btn order-btn"
          onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
          title="ソート方向を切替"
        >
          {sortOrder === "asc" ? "昇順" : "降順"}
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {sorted.length === 0 && <div className="today-empty">条件に一致するタスクがありません</div>}
      <ul>
        {sorted.map((issue) => (
          <li
            key={issue.id}
            className="today-item"
            data-issue-id={issue.id}
            data-issue-key={issue.issueKey}
            data-issue-summary={issue.summary}
          >
            <button
              type="button"
              className="check-btn"
              onClick={() => handleCheck(issue.id)}
              disabled={pending && checking === issue.id}
              title={`「${issue.status.name}」から「処理中」相当へ`}
            >
              {pending && checking === issue.id ? "…" : "▶"}
            </button>
            <div className="today-body">
              {issue.parentIssueId && (
                <div className="parent-chip parent-chip-today">
                  <span className="parent-arrow">↳</span>
                  {parentMap[issue.parentIssueId] ? (
                    <>
                      <span className="parent-key">{parentMap[issue.parentIssueId].issueKey}</span>
                      <span className="parent-name">{parentMap[issue.parentIssueId].name}</span>
                    </>
                  ) : (
                    <span className="parent-unresolved">#{issue.parentIssueId}</span>
                  )}
                </div>
              )}
              <div className="today-title-row">
                <span className="issue-key-chip">{issue.issueKey}</span>
                <span className="issue-summary">{issue.summary}</span>
              </div>
              <div className="today-meta-row">
                <span
                  className={`badge ${
                    isCompletedStatus(issue.status)
                      ? "badge-done"
                      : issue.status.name.includes("処理中")
                        ? "badge-progress"
                        : "badge-todo"
                  }`}
                >
                  {issue.status.name}
                </span>
                {issue.priority && (
                  <span
                    className={`badge ${
                      issue.priority.name === "高" || issue.priority.name === "High"
                        ? "badge-high"
                        : issue.priority.name === "低" || issue.priority.name === "Low"
                          ? "badge-low"
                          : "badge-normal"
                    }`}
                  >
                    {issue.priority.name}
                  </span>
                )}
                {issue.dueDate && <span className="meta-due">📅 {issue.dueDate}</span>}
              </div>
            </div>
            <label className="today-flag">
              <input
                type="checkbox"
                checked={issue.todayFlag}
                onChange={() => handleFlagToggle(issue.id, issue.todayFlag)}
              />
              今日
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
