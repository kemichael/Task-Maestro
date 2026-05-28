"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BacklogIssue } from "@/lib/types/backlog";

interface Props {
  issues: BacklogIssue[];
}

export function TodayList({ issues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<number | null>(null);

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
      {error && <div className="error-banner">{error}</div>}
      <ul>
        {issues.map((issue) => (
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
