"use client";

import { useState } from "react";
import type { TicketCandidate } from "@/lib/types/ticket";
import type { BacklogProjectSetting } from "@/lib/types/settings";
import CandidateEditor from "./CandidateEditor";

type Phase = "input" | "preview" | "candidates";

interface Props {
  projects: BacklogProjectSetting[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "リクエストに失敗しました");
  return data as T;
}

export default function DocumentExtractPane({ projects }: Props) {
  const [phase, setPhase] = useState<Phase>("input");
  const [docUrl, setDocUrl] = useState("");
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<TicketCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ text: string }>("/api/documents/fetch", { docUrl });
      setText(data.text);
      setPhase("preview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExtract() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ candidates: TicketCandidate[] }>("/api/documents/extract", {
        text,
        sourceRef: docUrl,
      });
      setCandidates(data.candidates);
      setPhase("candidates");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="extract-pane">
      {error && <p className="extract-error" role="alert">{error}</p>}

      {phase === "input" && (
        <div className="extract-input">
          <input
            type="url"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/..."
            aria-label="Google ドキュメント URL"
          />
          <button onClick={handleFetch} disabled={busy || !docUrl}>本文を取得</button>
        </div>
      )}

      {phase === "preview" && (
        <div className="extract-preview">
          <p>以下の本文を AI に送信します。内容を確認してください。</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          <div className="extract-actions">
            <button onClick={() => setPhase("input")} disabled={busy}>戻る</button>
            <button onClick={handleExtract} disabled={busy || !text}>AI 抽出を実行</button>
          </div>
        </div>
      )}

      {phase === "candidates" && (
        <div className="extract-candidates">
          <CandidateEditor
            candidates={candidates}
            projects={projects}
            sourceRef={docUrl}
            sourceKind="document"
          />
          <div className="extract-actions">
            <button onClick={() => setPhase("preview")} disabled={busy}>戻る</button>
          </div>
        </div>
      )}
    </div>
  );
}
