"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BacklogIssue } from "@/lib/types/backlog";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownView } from "./MarkdownView";
import { isCompletedStatus } from "@/lib/utils/issueStatus";

interface ParentRef {
  id: number;
  issueKey: string;
  name: string;
}

interface Props {
  issues: BacklogIssue[];
  parentMap?: Record<number, ParentRef>;
}

interface EditDraft {
  summary: string;
  description: string;
  dueDate: string;
  priorityId: string;
  assigneeId: string;
  categoryIds: string;
}

type SortKey = "due" | "priority" | "updated" | "key";
type SortOrder = "asc" | "desc";

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
    categoryIds: issue.categories && issue.categories.length > 0
      ? issue.categories.map((c) => String(c.id)).join(",")
      : "",
  };
}

function priorityRank(priority?: BacklogIssue["priority"]): number {
  if (!priority) return 99;
  const map: Record<string, number> = { 高: 1, 中: 2, 低: 3, High: 1, Normal: 2, Low: 3 };
  return map[priority.name] ?? 99;
}

function priorityBadgeClass(priority?: BacklogIssue["priority"]): string {
  if (!priority) return "badge badge-muted";
  if (priority.name === "高" || priority.name === "High") return "badge badge-high";
  if (priority.name === "低" || priority.name === "Low") return "badge badge-low";
  return "badge badge-normal";
}

function statusBadgeClass(status: BacklogIssue["status"]): string {
  if (isCompletedStatus(status)) return "badge badge-done";
  const name = status.name;
  if (name.includes("処理中") || name === "In Progress") return "badge badge-progress";
  if (name.includes("処理済") || name === "Resolved") return "badge badge-resolved";
  return "badge badge-todo";
}

function compare(a: BacklogIssue, b: BacklogIssue, key: SortKey, order: SortOrder): number {
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
    case "key":
      return a.issueKey.localeCompare(b.issueKey) * sign;
    default:
      return 0;
  }
}

export function IssueListClient({ issues, parentMap = {} }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");

  // フィルタ
  const [keyword, setKeyword] = useState("");
  const [projectFilter, setProjectFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<number | "" | "!completed">("!completed");
  const [priorityFilter, setPriorityFilter] = useState<number | "">("");
  const [dueFilter, setDueFilter] = useState<"all" | "overdue" | "today" | "thisWeek" | "thisMonth" | "noDate">("all");

  // ソート
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const projectOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const i of issues) {
      if (!map.has(i.projectId)) map.set(i.projectId, i.issueKey.split("-")[0] ?? String(i.projectId));
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [issues]);

  const statusOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const i of issues) {
      if (!map.has(i.status.id)) map.set(i.status.id, i.status.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [issues]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    const endOfWeekStr = endOfWeek.toISOString().slice(0, 10);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    return issues
      .filter((i) => {
        if (keyword) {
          const k = keyword.toLowerCase();
          const haystack = [i.summary, i.issueKey, i.description ?? ""].join(" ").toLowerCase();
          if (!haystack.includes(k)) return false;
        }
        if (projectFilter !== "" && i.projectId !== projectFilter) return false;
        if (statusFilter === "!completed") {
          if (isCompletedStatus(i.status)) return false;
        } else if (statusFilter !== "" && i.status.id !== statusFilter) {
          return false;
        }
        if (priorityFilter !== "" && i.priority?.id !== priorityFilter) return false;
        switch (dueFilter) {
          case "overdue":
            if (!i.dueDate || i.dueDate >= today) return false;
            break;
          case "today":
            if (i.dueDate !== today) return false;
            break;
          case "thisWeek":
            if (!i.dueDate || i.dueDate > endOfWeekStr) return false;
            break;
          case "thisMonth":
            if (!i.dueDate || i.dueDate > endOfMonth) return false;
            break;
          case "noDate":
            if (i.dueDate) return false;
            break;
        }
        return true;
      })
      .sort((a, b) => compare(a, b, sortKey, sortOrder));
  }, [issues, keyword, projectFilter, statusFilter, priorityFilter, dueFilter, sortKey, sortOrder]);

  const selected = issues.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null);
    setCommentBody("");
    setInfo(null);
    setError(null);
  }, [selectedId, selected]);

  const handleSelect = (issue: BacklogIssue) => setSelectedId(issue.id);

  const resetFilters = () => {
    setKeyword("");
    setProjectFilter("");
    setStatusFilter("!completed");
    setPriorityFilter("");
    setDueFilter("all");
  };

  const handleToggleToday = (issue: BacklogIssue) => {
    const next = !issue.todayFlag;
    startTransition(async () => {
      const res = await fetch(`/api/today/${issue.id}/flag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: next }),
      });
      if (!res.ok) {
        setError(`「今日やる」フラグ更新失敗 (${res.status})`);
        return;
      }
      router.refresh();
    });
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
    const currentCategoryIds = selected.categories?.map((c) => String(c.id)).join(",") ?? "";
    if (draft.categoryIds !== currentCategoryIds) {
      const ids = draft.categoryIds
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortOrder === "asc" ? "▲" : "▼") : "");

  return (
    <div className="issue-list-layout">
      <div className="issue-list-main">
        <div className="filter-bar card">
          <input
            type="text"
            placeholder="🔍 キーワード検索 (タイトル / キー / 本文)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="filter-keyword"
          />
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : "")}>
            <option value="">全プロジェクト</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") setStatusFilter("");
              else if (v === "!completed") setStatusFilter("!completed");
              else setStatusFilter(Number(v));
            }}
          >
            <option value="">全ステータス</option>
            <option value="!completed">完了以外</option>
            <option disabled>──────────</option>
            {statusOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value ? Number(e.target.value) : "")}>
            <option value="">全優先度</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)}>
            <option value="all">期限: 全て</option>
            <option value="overdue">期限切れ</option>
            <option value="today">本日のみ</option>
            <option value="thisWeek">今週中</option>
            <option value="thisMonth">今月中</option>
            <option value="noDate">期限なし</option>
          </select>
          <button type="button" className="ghost-btn" onClick={resetFilters}>
            クリア
          </button>
        </div>
        <div className="filter-summary">
          <span className="filter-count">{filtered.length}</span> / {issues.length} 件
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="issue-cards">
          {filtered.length === 0 && (
            <div className="empty-card card">
              {issues.length === 0
                ? "チケットがありません。「Backlog から取り込み」を実行してください。"
                : "条件に一致するチケットがありません"}
            </div>
          )}
          {filtered.map((issue) => {
            const parent = issue.parentIssueId ? parentMap[issue.parentIssueId] : undefined;
            const hasParent = !!issue.parentIssueId;
            const isSelected = selectedId === issue.id;
            return (
              <div
                key={issue.id}
                className={`issue-card ${hasParent ? "issue-card-child" : ""} ${isSelected ? "is-selected" : ""}`}
                onClick={() => handleSelect(issue)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-tm-issue",
                    JSON.stringify({ id: issue.id, summary: issue.summary, issueKey: issue.issueKey }),
                  );
                }}
              >
                <button
                  type="button"
                  className={`star-btn ${issue.todayFlag ? "is-on" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleToday(issue);
                  }}
                  disabled={pending}
                  title={issue.todayFlag ? "今日やるを解除" : "今日やるに追加"}
                  aria-label={issue.todayFlag ? "今日やるを解除" : "今日やるに追加"}
                >
                  {issue.todayFlag ? "★" : "☆"}
                </button>
                <div className="issue-card-body">
                  {hasParent && (
                    <div className="parent-chip">
                      {parent ? (
                        <>
                          <span className="parent-arrow">↳</span>
                          <span className="parent-key">{parent.issueKey}</span>
                          <span className="parent-name">{parent.name}</span>
                        </>
                      ) : (
                        <>
                          <span className="parent-arrow">↳</span>
                          <span className="parent-unresolved">#{issue.parentIssueId}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="issue-card-title-row">
                    <span className="issue-key-chip">{issue.issueKey}</span>
                    <span className="issue-card-title">{issue.summary}</span>
                  </div>
                  <div className="issue-card-meta">
                    <span className={statusBadgeClass(issue.status)}>{issue.status.name}</span>
                    {issue.priority && (
                      <span className={priorityBadgeClass(issue.priority)}>{issue.priority.name}</span>
                    )}
                    {issue.dueDate && (
                      <span className="meta-due">📅 {issue.dueDate}</span>
                    )}
                    {issue.assignee && (
                      <span className="meta-assignee">👤 {issue.assignee.name}</span>
                    )}
                    {issue.categories && issue.categories.length > 0 && (
                      <span className="meta-categories">
                        {issue.categories.map((c) => (
                          <span key={c.id} className="category-chip">
                            {c.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* ソートコントロール */}
        <div className="sort-bar">
          <span className="sort-label">並び替え:</span>
          {(["due", "priority", "updated", "key"] as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`sort-btn ${sortKey === k ? "is-active" : ""}`}
              onClick={() => toggleSort(k)}
            >
              {k === "due" ? "期限" : k === "priority" ? "優先度" : k === "updated" ? "更新日" : "キー"}{" "}
              {sortIndicator(k)}
            </button>
          ))}
        </div>
      </div>
      {selected && draft && (
        <div className="issue-detail card">
          <div className="issue-detail-header">
            <span className="issue-key-chip large">{selected.issueKey}</span>
            <span className={statusBadgeClass(selected.status)}>{selected.status.name}</span>
            <button
              type="button"
              className={`star-btn ${selected.todayFlag ? "is-on" : ""}`}
              onClick={() => handleToggleToday(selected)}
              disabled={pending}
              title={selected.todayFlag ? "今日やるを解除" : "今日やるに追加"}
            >
              {selected.todayFlag ? "★" : "☆"}
            </button>
          </div>
          {selected.parentIssueId && (
            <div className="parent-chip parent-chip-detail">
              <span className="parent-arrow">↳</span>
              {parentMap[selected.parentIssueId] ? (
                <>
                  <span className="parent-key">{parentMap[selected.parentIssueId].issueKey}</span>
                  <span className="parent-name">{parentMap[selected.parentIssueId].name}</span>
                </>
              ) : (
                <span className="parent-unresolved">#{selected.parentIssueId}</span>
              )}
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}
          {info && <div className="info-banner">{info}</div>}
          <label className="form-field">
            <span className="form-field-label">タイトル</span>
            <input
              type="text"
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </label>
          <div className="form-field">
            <span className="form-field-label">本文 (Markdown)</span>
            <MarkdownEditor
              value={draft.description}
              onChange={(v) => setDraft({ ...draft, description: v })}
              height={240}
            />
          </div>
          <details className="markdown-preview-toggle">
            <summary>本文プレビュー</summary>
            <MarkdownView content={draft.description} />
          </details>
          <div className="form-row">
            <label className="form-field">
              <span className="form-field-label">期限</span>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span className="form-field-label">優先度</span>
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
          </div>
          <div className="form-row">
            <label className="form-field">
              <span className="form-field-label">担当者 ID (空欄で未割当)</span>
              <input
                type="text"
                inputMode="numeric"
                value={draft.assigneeId}
                onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span className="form-field-label">カテゴリ ID (カンマ区切り)</span>
              <input
                type="text"
                placeholder="例: 12,34"
                value={draft.categoryIds}
                onChange={(e) => setDraft({ ...draft, categoryIds: e.target.value })}
              />
            </label>
          </div>
          {selected.categories && selected.categories.length > 0 && (
            <div className="current-categories">
              <span className="form-field-label">現在のカテゴリ:</span>
              {selected.categories.map((c) => (
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
          <div className="issue-detail-actions">
            <button type="button" onClick={handleAddComment} disabled={pending || !commentBody.trim()} className="ghost-btn">
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
