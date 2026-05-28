"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BacklogIssue, BacklogProjectStatus } from "@/lib/types/backlog";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownView } from "./MarkdownView";
import { isCompletedStatus } from "@/lib/utils/issueStatus";
import { normalizeDateForInput } from "@/lib/utils/date";

interface ParentRef {
  id: number;
  issueKey: string;
  name: string;
}

interface Props {
  issue: BacklogIssue;
  parent?: ParentRef;
  open: boolean;
  onClose: () => void;
}

const PRIORITY_OPTIONS: Array<{ id: number; name: string }> = [
  { id: 2, name: "高" },
  { id: 3, name: "中" },
  { id: 4, name: "低" },
];

function statusBadgeClass(status: BacklogIssue["status"]): string {
  if (isCompletedStatus(status)) return "badge badge-done";
  const name = status.name;
  if (name.includes("処理中") || name === "In Progress") return "badge badge-progress";
  if (name.includes("処理済") || name === "Resolved") return "badge badge-resolved";
  return "badge badge-todo";
}

export function EditTicketModal({ issue, parent, open, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const initialDueDate = normalizeDateForInput(issue.dueDate);
  const initialCategoryIds = issue.categories && issue.categories.length > 0
    ? issue.categories.map((c) => String(c.id)).join(",")
    : "";

  const [summary, setSummary] = useState(issue.summary);
  const [description, setDescription] = useState(issue.description ?? "");
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [priorityId, setPriorityId] = useState(issue.priority ? String(issue.priority.id) : "");
  const [statusId, setStatusId] = useState(String(issue.status.id));
  const [assigneeId, setAssigneeId] = useState(issue.assignee ? String(issue.assignee.id) : "");
  const [categoryIds, setCategoryIds] = useState(initialCategoryIds);
  const [commentBody, setCommentBody] = useState("");
  const [statuses, setStatuses] = useState<BacklogProjectStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // 起動時に最新の issue を初期値として再セット
  useEffect(() => {
    if (!open) return;
    setSummary(issue.summary);
    setDescription(issue.description ?? "");
    setDueDate(normalizeDateForInput(issue.dueDate));
    setPriorityId(issue.priority ? String(issue.priority.id) : "");
    setStatusId(String(issue.status.id));
    setAssigneeId(issue.assignee ? String(issue.assignee.id) : "");
    setCategoryIds(
      issue.categories && issue.categories.length > 0
        ? issue.categories.map((c) => String(c.id)).join(",")
        : "",
    );
    setCommentBody("");
    setError(null);
    setInfo(null);
  }, [issue, open]);

  // プロジェクトのステータス一覧を取得
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingStatuses(true);
    fetch(`/api/backlog/projects/${issue.projectId}/statuses`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: BacklogProjectStatus[]) => {
        if (!cancelled) setStatuses(data);
      })
      .catch(() => {
        if (!cancelled) setStatuses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStatuses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [issue.projectId, open]);

  if (!open) return null;

  const handleSave = () => {
    setError(null);
    setInfo(null);
    const patch: Record<string, unknown> = {};
    if (summary !== issue.summary) patch.summary = summary;
    if (description !== (issue.description ?? "")) patch.description = description;
    if (dueDate !== initialDueDate) patch.dueDate = dueDate || null;
    if (statusId !== String(issue.status.id)) {
      patch.statusId = Number(statusId);
    }
    const currentPriorityId = issue.priority ? String(issue.priority.id) : "";
    if (priorityId !== currentPriorityId && priorityId !== "") {
      patch.priorityId = Number(priorityId);
    }
    const currentAssigneeId = issue.assignee ? String(issue.assignee.id) : "";
    if (assigneeId !== currentAssigneeId) {
      patch.assigneeId = assigneeId ? Number(assigneeId) : null;
    }
    if (categoryIds !== initialCategoryIds) {
      const ids = categoryIds
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
      patch.categoryIds = ids;
    }
    if (commentBody.trim().length > 0) patch.commentBody = commentBody;
    if (Object.keys(patch).length === 0) {
      setInfo("変更がありません");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/backlog/issues/${issue.id}`, {
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
      // 少し待ってから閉じる
      setTimeout(() => onClose(), 500);
    });
  };

  const handleAddComment = () => {
    if (!commentBody.trim()) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fetch(`/api/backlog/issues/${issue.id}/comments`, {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-edit" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="issue-key-chip large">{issue.issueKey}</span>
            <span className={statusBadgeClass(issue.status)}>{issue.status.name}</span>
            {issue.priority && (
              <span className="badge badge-muted">{issue.priority.name}</span>
            )}
          </div>
          <button type="button" className="ghost-btn modal-close" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        {parent && (
          <div className="parent-chip parent-chip-detail">
            <span className="parent-arrow">↳</span>
            <span className="parent-key">{parent.issueKey}</span>
            <span className="parent-name">{parent.name}</span>
          </div>
        )}
        {issue.parentIssueId && !parent && (
          <div className="parent-chip parent-chip-detail">
            <span className="parent-arrow">↳</span>
            <span className="parent-unresolved">#{issue.parentIssueId}</span>
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
        {info && <div className="info-banner">{info}</div>}

        <label className="form-field">
          <span className="form-field-label">タイトル</span>
          <input type="text" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>

        <div className="form-field">
          <span className="form-field-label">本文 (Markdown)</span>
          <MarkdownEditor value={description} onChange={setDescription} height={240} />
        </div>
        <details className="markdown-preview-toggle">
          <summary>本文プレビュー</summary>
          <MarkdownView content={description} />
        </details>

        <div className="form-row">
          <label className="form-field">
            <span className="form-field-label">ステータス</span>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              disabled={loadingStatuses || statuses.length === 0}
            >
              {statuses.length === 0 && (
                <option value={issue.status.id}>{issue.status.name}</option>
              )}
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-field-label">優先度</span>
            <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
              <option value="">変更なし</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label className="form-field">
            <span className="form-field-label">期限 (空欄で解除)</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="form-field placeholder-field"></label>
        </div>
        <div className="form-row">
          <label className="form-field">
            <span className="form-field-label">担当者 ID (空欄で未割当)</span>
            <input
              type="text"
              inputMode="numeric"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span className="form-field-label">カテゴリ ID (カンマ区切り)</span>
            <input
              type="text"
              placeholder="例: 12,34"
              value={categoryIds}
              onChange={(e) => setCategoryIds(e.target.value)}
            />
          </label>
        </div>
        {issue.categories && issue.categories.length > 0 && (
          <div className="current-categories">
            <span className="form-field-label">現在のカテゴリ:</span>
            {issue.categories.map((c) => (
              <span key={c.id} className="category-chip">
                {c.id}: {c.name}
              </span>
            ))}
          </div>
        )}

        <div className="form-field">
          <span className="form-field-label">コメント追加 (Markdown)</span>
          <MarkdownEditor
            value={commentBody}
            onChange={setCommentBody}
            height={160}
            placeholder="コメントを Markdown で入力…"
          />
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="ghost-btn">
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleAddComment}
            disabled={pending || !commentBody.trim()}
            className="secondary-btn"
          >
            コメントのみ追加
          </button>
          <button type="button" onClick={handleSave} disabled={pending} className="primary-btn">
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
