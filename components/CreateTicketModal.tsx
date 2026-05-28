"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TicketDraft } from "@/lib/types/ticket";
import type { BacklogProjectSetting } from "@/lib/types/settings";
import { MarkdownEditor } from "./MarkdownEditor";

interface Props {
  open: boolean;
  onClose: () => void;
  projects: BacklogProjectSetting[];
  initial?: Partial<TicketDraft>;
}

export function CreateTicketModal({ open, onClose, projects, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [projectId, setProjectId] = useState<number | "">(initial?.projectId ?? projects[0]?.projectId ?? "");
  const [priority, setPriority] = useState<TicketDraft["priority"]>(initial?.priority);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (typeof projectId !== "number") {
      setError("プロジェクトを選択してください");
      return;
    }
    const draft: TicketDraft = {
      projectId,
      summary,
      description: description || undefined,
      priority: priority || undefined,
      dueDate: dueDate || undefined,
    };
    startTransition(async () => {
      const res = await fetch("/api/backlog/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `エラー (${res.status})`);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>チケットを作成</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <label>
            プロジェクト
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">選択…</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name ?? p.projectKey ?? `Project ${p.projectId}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            タイトル
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              maxLength={255}
            />
          </label>
          <div className="form-field">
            <label htmlFor="ticket-body">本文 (Markdown)</label>
            <MarkdownEditor
              value={description}
              onChange={setDescription}
              placeholder="Markdown 形式で本文を入力できます…"
              height={220}
            />
          </div>
          <label>
            優先度
            <select value={priority ?? ""} onChange={(e) => setPriority((e.target.value || undefined) as TicketDraft["priority"])}>
              <option value="">未指定</option>
              <option value="low">低</option>
              <option value="normal">中</option>
              <option value="high">高</option>
            </select>
          </label>
          <label>
            期限
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="secondary-btn">
              キャンセル
            </button>
            <button type="submit" disabled={pending} className="primary-btn">
              {pending ? "作成中…" : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
