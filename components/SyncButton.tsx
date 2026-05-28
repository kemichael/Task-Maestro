"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  label?: string;
}

export function SyncButton({ label = "Backlog から取り込み" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/backlog/issues/sync", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `エラー (${res.status})`);
        return;
      }
      const body = (await res.json()) as { fetched: number; inserted: number; updated: number };
      setMessage(`取得 ${body.fetched} 件 (新規 ${body.inserted} / 更新 ${body.updated})`);
      router.refresh();
    });
  };

  return (
    <div className="sync-button-wrapper">
      <button type="button" onClick={handleClick} disabled={pending} className="primary-btn">
        {pending ? "取り込み中…" : label}
      </button>
      {message && <span className="sync-message">{message}</span>}
      {error && <span className="sync-error">{error}</span>}
    </div>
  );
}
