"use client";

import { useState } from "react";
import type { TicketCandidate } from "@/lib/types/ticket";

type Phase = "input" | "preview" | "candidates";

interface EditableCandidate extends TicketCandidate {
  selected: boolean;
  projectId: string;
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

export default function DocumentExtractPane() {
  const [phase, setPhase] = useState<Phase>("input");
  const [docUrl, setDocUrl] = useState("");
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
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
      setCandidates(data.candidates.map((c) => ({ ...c, selected: true, projectId: "" })));
      setPhase("candidates");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updateCandidate(idx: number, patch: Partial<EditableCandidate>) {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  async function handleCreateTickets() {
    setBusy(true);
    setError(null);
    try {
      const targets = candidates.filter((c) => c.selected && c.projectId);
      if (targets.length === 0) {
        setError("チケット化する候補を選択し、プロジェクト ID を入力してください");
        return;
      }
      const invalid = targets.filter(
        (c) => c.suggested_due && !/^\d{4}-\d{2}-\d{2}$/.test(c.suggested_due),
      );
      if (invalid.length > 0) {
        setError(`期限は YYYY-MM-DD 形式で入力してください (${invalid.length} 件が不正)`);
        return;
      }
      const results = await Promise.allSettled(
        targets.map((c) =>
          postJson("/api/backlog/issues", {
            projectId: Number(c.projectId),
            summary: c.title,
            description: c.body ? `${c.body}\n\n${docUrl}` : docUrl,
            dueDate: c.suggested_due,
            sourceMeta: { kind: "document", ref: docUrl },
          }),
        ),
      );
      const succeeded = new Set(
        targets.filter((_, i) => results[i].status === "fulfilled"),
      );
      const okCount = succeeded.size;
      const failed = results.length - okCount;
      // 成功した候補はリストから除去し、再実行による重複作成を防ぐ
      setCandidates((prev) => prev.filter((c) => !succeeded.has(c)));
      setError(
        failed === 0
          ? `${okCount} 件のチケットを作成しました`
          : `${okCount} 件成功 / ${failed} 件失敗しました。失敗分はリストに残っています`,
      );
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
          {candidates.length === 0 && <p>抽出されたタスクはありませんでした。</p>}
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
          <div className="extract-actions">
            <button onClick={() => setPhase("preview")} disabled={busy}>戻る</button>
            <button onClick={handleCreateTickets} disabled={busy}>選択をチケット化</button>
          </div>
        </div>
      )}
    </div>
  );
}
