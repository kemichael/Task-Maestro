"use client";

import { useState } from "react";
import {
  GOOGLE_EVENT_COLORS,
  resolveEventColor,
} from "@/lib/constants/googleEventColors";
import type {
  CalendarEvent,
  GoogleEventColorId,
} from "@/lib/types/calendar";

interface EventEditModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

export function EventEditModal({ event, onClose, onSaved, onDeleted }: EventEditModalProps) {
  const [title, setTitle] = useState(event.title);
  const [startLocal, setStartLocal] = useState(toLocalInputValue(event.start));
  const [endLocal, setEndLocal] = useState(toLocalInputValue(event.end));
  const [description, setDescription] = useState(event.description ?? "");
  const [colorId, setColorId] = useState<GoogleEventColorId | null>(event.colorId ?? null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title,
        start: fromLocalInputValue(startLocal),
        end: fromLocalInputValue(endLocal),
        description,
      };
      if (colorId !== (event.colorId ?? null)) {
        body.colorId = colorId;
      }
      const res = await fetch(`/api/google/calendar/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `予定更新失敗 (${res.status})`);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/google/calendar/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`予定削除失敗 (${res.status})`);
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const currentSwatch = colorId
    ? resolveEventColor(colorId)
    : resolveEventColor(undefined);

  return (
    <div className="event-edit-modal__backdrop" onClick={onClose}>
      <div
        className="event-edit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="event-edit-modal__header">
          <h2>予定を編集</h2>
          <button
            type="button"
            className="event-edit-modal__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </header>

        {error && <div className="event-edit-modal__error">{error}</div>}

        <label className="event-edit-modal__field">
          <span>タイトル</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="event-edit-modal__row">
          <label className="event-edit-modal__field">
            <span>開始</span>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </label>
          <label className="event-edit-modal__field">
            <span>終了</span>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </label>
        </div>

        <fieldset className="event-edit-modal__color-fieldset">
          <legend>色</legend>
          <div className="event-edit-modal__color-grid">
            <button
              type="button"
              className={`event-edit-modal__color-button${colorId === null ? " is-selected" : ""}`}
              onClick={() => setColorId(null)}
              title="Default (カレンダー既定色)"
              aria-label="Default"
              style={{
                background: "transparent",
                borderColor: currentSwatch.background,
              }}
            >
              <span className="event-edit-modal__color-default-mark">∅</span>
            </button>
            {GOOGLE_EVENT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`event-edit-modal__color-button${colorId === c.id ? " is-selected" : ""}`}
                onClick={() => setColorId(c.id)}
                title={c.name}
                aria-label={c.name}
                style={{ background: c.background }}
              />
            ))}
          </div>
        </fieldset>

        <label className="event-edit-modal__field">
          <span>説明</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </label>

        <footer className="event-edit-modal__footer">
          <div className="event-edit-modal__footer-left">
            {!confirmingDelete ? (
              <button
                type="button"
                className="event-edit-modal__danger"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
              >
                🗑 削除
              </button>
            ) : (
              <div className="event-edit-modal__confirm">
                <span>本当に削除しますか?</span>
                <button
                  type="button"
                  className="event-edit-modal__danger"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  本当に削除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={saving}
                >
                  やめる
                </button>
              </div>
            )}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="event-edit-modal__external"
              >
                ↗ Google で開く
              </a>
            )}
          </div>
          <div className="event-edit-modal__footer-right">
            <button type="button" onClick={onClose} disabled={saving}>
              キャンセル
            </button>
            <button
              type="button"
              className="event-edit-modal__primary"
              onClick={handleSave}
              disabled={saving || !title}
            >
              保存
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
