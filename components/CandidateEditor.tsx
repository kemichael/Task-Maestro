"use client";

import { useEffect, useState } from "react";
import type { TicketCandidate } from "@/lib/types/ticket";
import type { BacklogProjectSetting } from "@/lib/types/settings";

/** 登録先: "today" = ローカルメモタスク / "bl:<projectId>" = Backlog プロジェクト */
interface EditableRow extends TicketCandidate {
  selected: boolean;
  dest: string;
}

interface Props {
  /** 抽出された候補 (新しい配列が渡るたびに編集状態を作り直す) */
  candidates: TicketCandidate[];
  /** 設定済みの Backlog プロジェクト */
  projects: BacklogProjectSetting[];
  /** 元ドキュメント / 議事録の URL。本文末尾とソース参照に使う */
  sourceRef: string;
  /** Backlog チケットの sourceMeta.kind */
  sourceKind: "document" | "meeting";
  /** 候補が空のときに出す文言 */
  emptyMessage?: string;
  /** 選択分がすべて登録に成功したときに呼ばれる (議事録の処理済みマーク等に使う) */
  onAllCreated?: () => void | Promise<void>;
}

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data?.message ?? `登録に失敗しました (${res.status})`);
  }
}

export default function CandidateEditor({
  candidates,
  projects,
  sourceRef,
  sourceKind,
  emptyMessage = "抽出されたタスクはありませんでした。",
  onAllCreated,
}: Props) {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 新しい候補が来たら編集状態を作り直す
  useEffect(() => {
    setRows(candidates.map((c) => ({ ...c, selected: true, dest: "" })));
    setMessage(null);
  }, [candidates]);

  function update(idx: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  /** 1 件分の登録。登録先 (dest) に応じて Backlog チケット or ローカルメモタスクを作る */
  function createOne(row: EditableRow): Promise<void> {
    // 概要 (body) があれば本文に出典 URL を併記する
    const description = row.body ? `${row.body}\n\n${sourceRef}` : sourceRef;
    const dueDate = row.suggested_due || undefined;
    if (row.dest === "today") {
      return postJson("/api/local-tasks", {
        title: row.title,
        notes: description,
        dueDate,
      });
    }
    const projectId = Number(row.dest.replace(/^bl:/, ""));
    return postJson("/api/backlog/issues", {
      projectId,
      summary: row.title,
      description,
      dueDate,
      sourceMeta: { kind: sourceKind, ref: sourceRef },
    });
  }

  async function handleCreate() {
    setBusy(true);
    setMessage(null);
    try {
      const targets = rows.filter((r) => r.selected && r.dest);
      if (targets.length === 0) {
        setMessage("登録する候補を選び、登録先を指定してください");
        return;
      }
      const invalidDate = targets.filter(
        (r) => r.suggested_due && !/^\d{4}-\d{2}-\d{2}$/.test(r.suggested_due),
      );
      if (invalidDate.length > 0) {
        setMessage(`期限の形式が不正です (${invalidDate.length} 件)`);
        return;
      }
      const results = await Promise.allSettled(targets.map((r) => createOne(r)));
      const succeeded = new Set(targets.filter((_, i) => results[i].status === "fulfilled"));
      const failed = results.length - succeeded.size;
      // 成功分はリストから除去し、再実行による重複登録を防ぐ
      setRows((prev) => prev.filter((r) => !succeeded.has(r)));
      if (failed === 0) {
        setMessage(`${succeeded.size} 件を登録しました`);
        if (onAllCreated) await onAllCreated();
      } else {
        setMessage(`${succeeded.size} 件成功 / ${failed} 件失敗しました。失敗分はリストに残っています`);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="candidate-editor">
      {message && <p className="extract-error" role="status">{message}</p>}
      {rows.length === 0 && <p>{emptyMessage}</p>}
      {rows.map((r, i) => (
        <div key={i} className="candidate-row">
          <input
            type="checkbox"
            checked={r.selected}
            onChange={(e) => update(i, { selected: e.target.checked })}
            aria-label="登録対象"
          />
          <input
            value={r.title}
            onChange={(e) => update(i, { title: e.target.value })}
            aria-label="タイトル"
            placeholder="タイトル"
          />
          <select
            value={r.dest}
            onChange={(e) => update(i, { dest: e.target.value })}
            aria-label="登録先"
          >
            <option value="">登録先…</option>
            <option value="today">今日やる (メモタスク)</option>
            {projects.map((p) => (
              <option key={p.projectId} value={`bl:${p.projectId}`}>
                {p.name ?? p.projectKey ?? `Project ${p.projectId}`}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={r.suggested_due ?? ""}
            onChange={(e) => update(i, { suggested_due: e.target.value || undefined })}
            aria-label="期限"
          />
          <textarea
            value={r.body ?? ""}
            onChange={(e) => update(i, { body: e.target.value || undefined })}
            aria-label="概要"
            placeholder="概要 (Backlog の本文 / メモタスクの内容に登録されます)"
            rows={2}
          />
        </div>
      ))}
      {rows.length > 0 && (
        <button onClick={handleCreate} disabled={busy}>
          選択を登録
        </button>
      )}
    </div>
  );
}
