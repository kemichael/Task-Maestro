"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LocalTask } from "@/lib/types/localTask";
import {
  KANBAN_COLUMNS,
  KANBAN_COLUMN_LABEL,
  type LocalTaskStatus,
} from "@/lib/types/kanban";

interface Props {
  tasks: LocalTask[];
}

interface EditState {
  id: number;
  title: string;
  notes: string;
  dueDate: string;
}

export function LocalTaskList({ tasks }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const [editing, setEditing] = useState<EditState | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const resetNewForm = () => {
    setNewTitle("");
    setNewNotes("");
    setNewDueDate("");
    setShowForm(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      setError("タイトルを入力してください");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/local-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes: newNotes.trim() || null,
          dueDate: newDueDate || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `作成失敗 (${res.status})`);
        return;
      }
      resetNewForm();
      router.refresh();
    });
  };

  const handleChangeStatus = (task: LocalTask, status: LocalTaskStatus) => {
    if (status === task.status) return;
    setError(null);
    setBusyId(task.id);
    startTransition(async () => {
      const res = await fetch(`/api/local-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `更新失敗 (${res.status})`);
      } else {
        router.refresh();
      }
      setBusyId(null);
    });
  };

  const handleDelete = (task: LocalTask) => {
    if (!confirm(`「${task.title}」を削除しますか？`)) return;
    setError(null);
    setBusyId(task.id);
    startTransition(async () => {
      const res = await fetch(`/api/local-tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `削除失敗 (${res.status})`);
      } else {
        router.refresh();
      }
      setBusyId(null);
    });
  };

  const handleStartEdit = (task: LocalTask) => {
    setEditing({
      id: task.id,
      title: task.title,
      notes: task.notes ?? "",
      dueDate: task.dueDate ?? "",
    });
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) {
      setError("タイトルを入力してください");
      return;
    }
    setError(null);
    setBusyId(editing.id);
    const payload = editing;
    startTransition(async () => {
      const res = await fetch(`/api/local-tasks/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes: payload.notes.trim() || null,
          dueDate: payload.dueDate || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `更新失敗 (${res.status})`);
      } else {
        setEditing(null);
        router.refresh();
      }
      setBusyId(null);
    });
  };

  return (
    <div className="local-tasks">
      <div className="local-tasks-header">
        <span className="local-tasks-title">メモタスク</span>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "閉じる" : "+ 追加"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <form className="local-task-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="タイトル (必須)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <textarea
            placeholder="メモ (任意)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            rows={2}
          />
          <div className="local-task-form-row">
            <label>
              期限
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </label>
            <div className="local-task-form-actions">
              <button type="button" className="ghost-btn" onClick={resetNewForm}>
                キャンセル
              </button>
              <button type="submit" className="primary-btn" disabled={pending}>
                {pending ? "保存中…" : "追加"}
              </button>
            </div>
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="today-empty">メモタスクはありません</div>
      ) : (
        <ul className="local-task-list">
          {tasks.map((task) => {
            const isEditing = editing?.id === task.id;
            const completed = task.status === "done";
            return (
              <li
                key={task.id}
                className={`local-task-item${completed ? " completed" : ""}`}
                data-local-task-id={task.id}
                data-local-task-title={task.title}
              >
                <select
                  className="local-task-status"
                  value={task.status}
                  onChange={(e) =>
                    handleChangeStatus(task, e.target.value as LocalTaskStatus)
                  }
                  disabled={pending && busyId === task.id}
                  aria-label="ステータス"
                  data-status={task.status}
                >
                  {KANBAN_COLUMNS.map((col) => (
                    <option key={col} value={col}>
                      {KANBAN_COLUMN_LABEL[col]}
                    </option>
                  ))}
                </select>
                {isEditing ? (
                  <div className="local-task-edit">
                    <input
                      type="text"
                      value={editing!.title}
                      onChange={(e) =>
                        setEditing({ ...editing!, title: e.target.value })
                      }
                    />
                    <textarea
                      value={editing!.notes}
                      onChange={(e) =>
                        setEditing({ ...editing!, notes: e.target.value })
                      }
                      rows={2}
                      placeholder="メモ"
                    />
                    <div className="local-task-form-row">
                      <label>
                        期限
                        <input
                          type="date"
                          value={editing!.dueDate}
                          onChange={(e) =>
                            setEditing({ ...editing!, dueDate: e.target.value })
                          }
                        />
                      </label>
                      <div className="local-task-form-actions">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setEditing(null)}
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={handleSaveEdit}
                          disabled={pending}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="local-task-body">
                    <div className="local-task-title">{task.title}</div>
                    {task.notes && (
                      <div className="local-task-notes">{task.notes}</div>
                    )}
                    {task.dueDate && (
                      <div className="local-task-due">📅 {task.dueDate}</div>
                    )}
                  </div>
                )}
                {!isEditing && (
                  <div className="local-task-actions">
                    <button
                      type="button"
                      className="ghost-btn icon-btn"
                      onClick={() => handleStartEdit(task)}
                      title="編集"
                      aria-label="編集"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="ghost-btn icon-btn"
                      onClick={() => handleDelete(task)}
                      title="削除"
                      aria-label="削除"
                      disabled={pending && busyId === task.id}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
