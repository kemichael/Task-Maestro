"use client";

import { useState } from "react";
import type { TicketCandidate } from "@/lib/types/ticket";
import type { BacklogProjectSetting } from "@/lib/types/settings";
import CandidateEditor from "./CandidateEditor";

type Phase = "input" | "preview" | "candidates";

interface Props {
  projects: BacklogProjectSetting[];
}

const STEPS: { key: Phase; label: string }[] = [
  { key: "input", label: "URL 入力" },
  { key: "preview", label: "本文確認" },
  { key: "candidates", label: "候補登録" },
];

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

  const phaseIndex = STEPS.findIndex((s) => s.key === phase);

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
    <div className="extract-pane card">
      <ol className="extract-steps" aria-label="抽出ステップ">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={`extract-step${i === phaseIndex ? " is-active" : ""}${i < phaseIndex ? " is-done" : ""}`}
          >
            <span className="extract-step__no">{String(i + 1).padStart(2, "0")}</span>
            <span className="extract-step__label">{s.label}</span>
          </li>
        ))}
      </ol>

      {error && <p className="error-banner" role="alert">{error}</p>}

      {phase === "input" && (
        <div className="extract-input">
          <label className="form-field">
            <span className="form-field-label">Google ドキュメント URL</span>
            <input
              type="url"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              aria-label="Google ドキュメント URL"
            />
          </label>
          <button className="primary-btn" onClick={handleFetch} disabled={busy || !docUrl}>
            {busy ? "取得中…" : "本文を取得"}
          </button>
        </div>
      )}

      {phase === "preview" && (
        <div className="extract-preview">
          <p className="info-banner">以下の本文を AI に送信します。内容を確認してください。</p>
          <textarea
            className="extract-preview__text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            aria-label="ドキュメント本文"
          />
          <div className="extract-actions">
            <button className="secondary-btn" onClick={() => setPhase("input")} disabled={busy}>
              ← 戻る
            </button>
            <button className="primary-btn" onClick={handleExtract} disabled={busy || !text}>
              {busy ? "抽出中…" : "AI 抽出を実行"}
            </button>
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
            <button className="secondary-btn" onClick={() => setPhase("preview")} disabled={busy}>
              ← 本文に戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
