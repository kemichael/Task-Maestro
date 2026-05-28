"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BacklogIssue } from "@/lib/types/backlog";

interface Props {
  issues: BacklogIssue[];
}

export function IssueListClient({ issues }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<BacklogIssue | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const handleStatusChange = (issue: BacklogIssue, statusId: number) => {
    startTransition(async () => {
      const res = await fetch(`/api/backlog/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `エラー (${res.status})`);
        return;
      }
      router.refresh();
    });
  };

  const handleAddComment = () => {
    if (!selected || !commentBody.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/backlog/issues/${selected.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      if (!res.ok) {
        setError(`コメント追加失敗 (${res.status})`);
        return;
      }
      setCommentBody("");
    });
  };

  return (
    <div className="issue-list-layout">
      {error && <div className="error-banner">{error}</div>}
      <table className="issue-table">
        <thead>
          <tr>
            <th>キー</th>
            <th>タイトル</th>
            <th>状態</th>
            <th>優先度</th>
            <th>担当</th>
            <th>期限</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id} onClick={() => setSelected(issue)} className={selected?.id === issue.id ? "selected" : ""}>
              <td>{issue.issueKey}</td>
              <td>{issue.summary}</td>
              <td>{issue.status.name}</td>
              <td>{issue.priority?.name ?? "—"}</td>
              <td>{issue.assignee?.name ?? "—"}</td>
              <td>{issue.dueDate ?? "—"}</td>
            </tr>
          ))}
          {issues.length === 0 && (
            <tr>
              <td colSpan={6}>チケットがありません。「Backlog から取り込み」を実行してください。</td>
            </tr>
          )}
        </tbody>
      </table>
      {selected && (
        <div className="issue-detail">
          <h3>
            {selected.issueKey} — {selected.summary}
          </h3>
          <p>状態: {selected.status.name}</p>
          <p>本文:</p>
          <pre>{selected.description ?? "(本文なし)"}</pre>
          <div className="comment-form">
            <textarea
              placeholder="コメント追加"
              rows={3}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button onClick={handleAddComment} disabled={pending} className="primary-btn">
              コメント送信
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
