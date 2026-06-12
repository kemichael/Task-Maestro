"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetingDoc } from "@/lib/types/meeting";
import type { TicketCandidate } from "@/lib/types/ticket";
import type { BacklogProjectSetting } from "@/lib/types/settings";
import CandidateEditor from "./CandidateEditor";

interface Props {
  projects: BacklogProjectSetting[];
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

/** ISO 文字列を読みやすい日時に整形する (失敗時はそのまま返す) */
function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MeetingExtractPane({ projects }: Props) {
  const [meetings, setMeetings] = useState<MeetingDoc[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<TicketCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
      setLoaded(true);
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
      setCandidates(data.candidates);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const activeMeeting = activeId != null ? meetings.find((m) => m.id === activeId) : undefined;
  const activeRef = activeMeeting?.docUrl ?? "";

  // 選択分がすべて登録できたら議事録を処理済みにする
  async function handleAllCreated() {
    if (activeId == null) return;
    await postJson(`/api/meetings/${activeId}`);
    setActiveId(null);
    setCandidates([]);
    await loadMeetings();
  }

  return (
    <div className="meeting-pane">
      <div className="meeting-toolbar">
        <span className="meeting-toolbar__count">
          未処理 <em>{meetings.length}</em> 件
        </span>
        <button className="secondary-btn" onClick={loadMeetings} disabled={busy}>
          {busy ? "検出中…" : "↻ 議事録を再検出"}
        </button>
      </div>

      {error && <p className="error-banner" role="alert">{error}</p>}

      <ul className="meeting-list">
        {loaded && meetings.length === 0 && (
          <li className="console-empty">未処理の議事録はありません。</li>
        )}
        {meetings.map((m) => (
          <li
            key={m.id}
            className={`meeting-card card${activeId === m.id ? " is-active" : ""}`}
          >
            <div className="meeting-card__main">
              <span className="meeting-card__title">{m.title}</span>
              <span className="meeting-card__meta">
                <span className="meeting-card__date">{formatOccurredAt(m.occurredAt)}</span>
                {m.docUrl && (
                  <a className="meeting-card__link" href={m.docUrl} target="_blank" rel="noreferrer">
                    議事録 ↗
                  </a>
                )}
              </span>
            </div>
            <button
              className={activeId === m.id ? "primary-btn" : "secondary-btn"}
              onClick={() => handleExtract(m.id)}
              disabled={busy}
            >
              抽出
            </button>
          </li>
        ))}
      </ul>

      {activeId != null && (
        <div className="extract-candidates">
          <CandidateEditor
            candidates={candidates}
            projects={projects}
            sourceRef={activeRef}
            sourceKind="meeting"
            emptyMessage="抽出されたネクストアクションはありませんでした。"
            onAllCreated={handleAllCreated}
          />
        </div>
      )}
    </div>
  );
}
