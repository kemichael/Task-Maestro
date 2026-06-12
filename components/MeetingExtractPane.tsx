"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetingDoc } from "@/lib/types/meeting";
import type { TicketCandidate } from "@/lib/types/ticket";

interface EditableCandidate extends TicketCandidate {
  selected: boolean;
  projectId: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "取得に失敗しました");
  return data as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "リクエストに失敗しました");
  return data as T;
}

export default function MeetingExtractPane() {
  const [meetings, setMeetings] = useState<MeetingDoc[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await getJson<{ meetings: MeetingDoc[] }>("/api/meetings");
      setMeetings(data.meetings);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  async function handleExtract(id: number) {
    setBusy(true);
    setError(null);
    setActiveId(id);
    try {
      const data = await postJson<{ candidates: TicketCandidate[] }>(`/api/meetings/${id}/extract`);
      setCandidates(data.candidates.map((c) => ({ ...c, selected: true, projectId: "" })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updateCandidate(idx: number, patch: Partial<EditableCandidate>) {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  async function handleCreateAndComplete() {
    if (activeId == null) return;
    setBusy(true);
    setError(null);
    try {
      const active = meetings.find((m) => m.id === activeId);
      const ref = active?.docUrl ?? "";
      const targets = candidates.filter((c) => c.selected && c.projectId);
      for (const c of targets) {
        await postJson("/api/backlog/issues", {
          projectId: Number(c.projectId),
          summary: c.title,
          description: c.body ? `${c.body}\n\n${ref}` : ref,
          dueDate: c.suggested_due,
          sourceMeta: { kind: "meeting", ref },
        });
      }
      await postJson(`/api/meetings/${activeId}`);
      setCandidates([]);
      setActiveId(null);
      await loadMeetings();
      setError(`${targets.length} 件のチケットを作成し、議事録を処理済みにしました`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="meeting-pane">
      {error && <p className="extract-error" role="alert">{error}</p>}
      <button onClick={loadMeetings} disabled={busy}>議事録を再検出</button>

      <ul className="meeting-list">
        {meetings.length === 0 && <li>未処理の議事録はありません。</li>}
        {meetings.map((m) => (
          <li key={m.id} className="meeting-item">
            <span>{m.title}</span>
            <span className="meeting-date">{m.occurredAt}</span>
            {m.docUrl && <a href={m.docUrl} target="_blank" rel="noreferrer">議事録</a>}
            <button onClick={() => handleExtract(m.id)} disabled={busy}>抽出</button>
          </li>
        ))}
      </ul>

      {activeId != null && (
        <div className="extract-candidates">
          {candidates.length === 0 && <p>抽出されたネクストアクションはありませんでした。</p>}
          {candidates.map((c, i) => (
            <div key={i} className="candidate-row">
              <input
                type="checkbox"
                checked={c.selected}
                onChange={(e) => updateCandidate(i, { selected: e.target.checked })}
                aria-label="チケット化対象"
              />
              <input value={c.title} onChange={(e) => updateCandidate(i, { title: e.target.value })} aria-label="タイトル" />
              <input
                value={c.projectId}
                onChange={(e) => updateCandidate(i, { projectId: e.target.value })}
                placeholder="プロジェクト ID"
                aria-label="プロジェクト ID"
              />
              <input
                value={c.suggested_due ?? ""}
                onChange={(e) => updateCandidate(i, { suggested_due: e.target.value || undefined })}
                placeholder="YYYY-MM-DD"
                aria-label="期限"
              />
            </div>
          ))}
          {candidates.length > 0 && (
            <button onClick={handleCreateAndComplete} disabled={busy}>選択をチケット化して処理済みに</button>
          )}
        </div>
      )}
    </div>
  );
}
