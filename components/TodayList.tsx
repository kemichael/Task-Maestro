"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BacklogIssue } from "@/lib/types/backlog";
import type { BacklogProjectSetting } from "@/lib/types/settings";

interface Props {
  issues: BacklogIssue[];
  projects?: BacklogProjectSetting[];
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

export function TodayList({ issues, projects = [] }: Props) {
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

  const handleDragStart = (e: React.DragEvent, issue: BacklogIssue) => {
    e.dataTransfer.setData(
      "application/x-tm-issue",
      JSON.stringify({ id: issue.id, summary: issue.summary, issueKey: issue.issueKey }),
    );
    e.dataTransfer.effectAllowed = "copy";
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
          <li key={issue.id} className="today-item" draggable onDragStart={(e) => handleDragStart(e, issue)}>
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
              <span className="issue-key">{issue.issueKey}</span>
              <span className="issue-summary">{issue.summary}</span>
              <span className="issue-meta">
                {issue.dueDate ? `期限: ${issue.dueDate}` : "期限なし"} ・ {issue.status.name}
                {issue.priority ? ` ・ ${issue.priority.name}` : ""}
              </span>
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
