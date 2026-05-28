"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BacklogIssue } from "@/lib/types/backlog";

interface Props {
  issues: BacklogIssue[];
}

interface EditDraft {
  summary: string;
  description: string;
  dueDate: string;
  priorityId: string;
  assigneeId: string;
  categoryIds: string;
}

const PRIORITY_OPTIONS: Array<{ id: number; name: string }> = [
  { id: 2, name: "高" },
  { id: 3, name: "中" },
  { id: 4, name: "低" },
];

function toDraft(issue: BacklogIssue): EditDraft {
  return {
    summary: issue.summary,
    description: issue.description ?? "",
    dueDate: issue.dueDate ?? "",
    priorityId: issue.priority ? String(issue.priority.id) : "",
    assigneeId: issue.assignee ? String(issue.assignee.id) : "",
    categoryIds: "",
  };
}

export function IssueListClient({ issues }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const selected = issues.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null);
    setCommentBody("");
    setInfo(null);
    setError(null);
  }, [selectedId, selected]);

  const handleSelect = (issue: BacklogIssue) => {
    setSelectedId(issue.id);
  };

  const handleSave = () => {
    if (!selected || !draft) return;
    setError(null);
    setInfo(null);
    const patch: Record<string, unknown> = {};
    if (draft.summary !== selected.summary) patch.summary = draft.summary;
    if (draft.description !== (selected.description ?? "")) patch.description = draft.description;
    if (draft.dueDate !== (selected.dueDate ?? "")) patch.dueDate = draft.dueDate || null;
    const currentPriorityId = selected.priority ? String(selected.priority.id) : "";
    if (draft.priorityId !== currentPriorityId && draft.priorityId !== "") {
      patch.priorityId = Number(draft.priorityId);
    }
    const currentAssigneeId = selected.assignee ? String(selected.assignee.id) : "";
    if (draft.assigneeId !== currentAssigneeId) {
      patch.assigneeId = draft.assigneeId ? Number(draft.assigneeId) : null;
    }
    if (draft.categoryIds.trim().length > 0) {
      const ids = draft.categoryIds
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
      if (ids.length > 0) patch.categoryIds = ids;
    }
    if (commentBody.trim().length > 0) patch.commentBody = commentBody;
    if (Object.keys(patch).length === 0) {
      setInfo("変更がありません");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/backlog/issues/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `エラー (${res.status})`);
        return;
      }
      setInfo("保存しました");
      setCommentBody("");
      router.refresh();
    });
  };

  const handleAddComment = () => {
    if (!selected || !commentBody.trim()) return;
    setError(null);
    setInfo(null);
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
      setInfo("コメントを追加しました");
    });
  };

  return (
    <div className="issue-list-layout">
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
            <tr
              key={issue.id}
              onClick={() => handleSelect(issue)}
              className={selectedId === issue.id ? "selected" : ""}
            >
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
      {selected && draft && (
        <div className="issue-detail">
          <h3>{selected.issueKey}</h3>
          {error && <div className="error-banner">{error}</div>}
          {info && <div className="info-banner">{info}</div>}
          <label>
            タイトル
            <input
              type="text"
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </label>
          <label>
            本文
            <textarea
              rows={6}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label>
            期限 (空欄で解除)
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
          </label>
          <label>
            優先度
            <select
              value={draft.priorityId}
              onChange={(e) => setDraft({ ...draft, priorityId: e.target.value })}
            >
              <option value="">変更なし</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            担当者 ID (空欄で未割当)
            <input
              type="text"
              inputMode="numeric"
              value={draft.assigneeId}
              onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
            />
          </label>
          <label>
            カテゴリ ID (カンマ区切りで追記)
            <input
              type="text"
              placeholder="例: 12,34"
              value={draft.categoryIds}
              onChange={(e) => setDraft({ ...draft, categoryIds: e.target.value })}
            />
          </label>
          <label>
            コメント追加 (任意)
            <textarea
              rows={3}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
          </label>
          <div className="issue-detail-actions">
            <button type="button" onClick={handleAddComment} disabled={pending || !commentBody.trim()} className="secondary-btn">
              コメントのみ追加
            </button>
            <button type="button" onClick={handleSave} disabled={pending} className="primary-btn">
              {pending ? "保存中…" : "保存"}
            </button>
          </div>
          <p className="hint">状態 ({selected.status.name}) はダッシュボードの「今日やる」着手ボタンで「処理中」相当へ遷移します。</p>
        </div>
      )}
    </div>
  );
}
