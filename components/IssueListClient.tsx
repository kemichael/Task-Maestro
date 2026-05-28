"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BacklogIssue } from "@/lib/types/backlog";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownView } from "./MarkdownView";
import { isCompletedStatus } from "@/lib/utils/issueStatus";

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
    categoryIds: "",
  };
}

function priorityRank(priority?: BacklogIssue["priority"]): number {
  if (!priority) return 99;
  const map: Record<string, number> = { 高: 1, 中: 2, 低: 3, High: 1, Normal: 2, Low: 3 };
  return map[priority.name] ?? 99;
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

export function IssueListClient({ issues }: Props) {
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
  // "" = 全 / "!completed" = 完了以外 / number = 個別 status_id
  const [statusFilter, setStatusFilter] = useState<number | "" | "!completed">("!completed");
  const [priorityFilter, setPriorityFilter] = useState<number | "">("");
  const [dueFilter, setDueFilter] = useState<"all" | "overdue" | "today" | "thisWeek" | "thisMonth" | "noDate">("all");

  // ソート
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // 一覧から選択肢を派生
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

  // フィルタ + ソート結果
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

  const selected = filtered.find((i) => i.id === selectedId) ?? issues.find((i) => i.id === selectedId) ?? null;

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
    // デフォルトは「完了以外」(完了済みチケットでノイズを増やさない)
    setStatusFilter("!completed");
    setPriorityFilter("");
    setDueFilter("all");
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortOrder === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="issue-list-layout">
      <div className="issue-list-main">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="キーワード検索 (タイトル/キー/本文)"
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
          <button type="button" className="secondary-btn" onClick={resetFilters}>
            フィルタ解除
          </button>
        </div>
        <div className="filter-summary">
          {filtered.length} / {issues.length} 件
        </div>
        <table className="issue-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort("key")}>キー{sortIndicator("key")}</th>
              <th>タイトル</th>
              <th>状態</th>
              <th className="sortable" onClick={() => toggleSort("priority")}>優先度{sortIndicator("priority")}</th>
              <th>担当</th>
              <th className="sortable" onClick={() => toggleSort("due")}>期限{sortIndicator("due")}</th>
              <th className="sortable" onClick={() => toggleSort("updated")}>更新{sortIndicator("updated")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((issue) => (
              <tr
                key={issue.id}
                onClick={() => handleSelect(issue)}
                className={selectedId === issue.id ? "selected" : ""}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-tm-issue",
                    JSON.stringify({ id: issue.id, summary: issue.summary, issueKey: issue.issueKey }),
                  );
                }}
              >
                <td>{issue.issueKey}</td>
                <td>{issue.summary}</td>
                <td>{issue.status.name}</td>
                <td>{issue.priority?.name ?? "—"}</td>
                <td>{issue.assignee?.name ?? "—"}</td>
                <td>{issue.dueDate ?? "—"}</td>
                <td>{issue.updatedAt.slice(0, 10)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {issues.length === 0
                    ? "チケットがありません。「Backlog から取り込み」を実行してください。"
                    : "条件に一致するチケットがありません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
          <div className="form-field">
            <span className="form-field-label">本文 (Markdown)</span>
            <MarkdownEditor
              value={draft.description}
              onChange={(v) => setDraft({ ...draft, description: v })}
              height={220}
            />
          </div>
          <details className="markdown-preview-toggle">
            <summary>本文プレビュー</summary>
            <MarkdownView content={draft.description} />
          </details>
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
