"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppSettings } from "@/lib/types/settings";

interface Props {
  initial: AppSettings;
}

export function SettingsForm({ initial }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `エラー (${res.status})`);
        return;
      }
      setMessage("保存しました");
      router.refresh();
    });
  };

  const fetchMyself = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/backlog/myself");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `自動取得に失敗 (${res.status})`);
        return;
      }
      const user = (await res.json()) as {
        userId: number;
        name?: string;
        loginId?: string;
      };
      setSettings({
        ...settings,
        backlog: {
          ...settings.backlog,
          self: { userId: user.userId, name: user.name, loginId: user.loginId },
        },
      });
      setMessage(
        `自分の Backlog ユーザを取得: ${user.name ?? "(no name)"} (ID: ${user.userId})。「設定を保存」で確定してください。`,
      );
    });
  };

  const clearMyself = () => {
    setSettings({
      ...settings,
      backlog: { ...settings.backlog, self: undefined },
    });
  };

  const addProject = () => {
    setSettings({
      ...settings,
      backlog: {
        projects: [
          ...settings.backlog.projects,
          { projectId: 0, projectKey: "", name: "" },
        ],
      },
    });
  };
  const removeProject = (i: number) => {
    setSettings({
      ...settings,
      backlog: { projects: settings.backlog.projects.filter((_, idx) => idx !== i) },
    });
  };
  const updateProject = (i: number, key: "projectId" | "projectKey" | "name", value: string) => {
    const next = [...settings.backlog.projects];
    if (key === "projectId") next[i] = { ...next[i], projectId: Number(value) || 0 };
    else next[i] = { ...next[i], [key]: value };
    setSettings({ ...settings, backlog: { projects: next } });
  };

  const addMapping = () => {
    setSettings({
      ...settings,
      statusMapping: [
        ...settings.statusMapping,
        { projectId: 0, inProgressStatusId: 0 },
      ],
    });
  };
  const removeMapping = (i: number) => {
    setSettings({
      ...settings,
      statusMapping: settings.statusMapping.filter((_, idx) => idx !== i),
    });
  };
  const updateMapping = (i: number, key: "projectId" | "inProgressStatusId", value: string) => {
    const next = [...settings.statusMapping];
    next[i] = { ...next[i], [key]: Number(value) || 0 };
    setSettings({ ...settings, statusMapping: next });
  };

  return (
    <div className="settings-form">
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="info-banner">{message}</div>}

      <section>
        <h3>AI プロバイダ</h3>
        <label>
          プロバイダ:{" "}
          <select
            value={settings.ai.provider}
            onChange={(e) =>
              setSettings({ ...settings, ai: { ...settings.ai, provider: e.target.value as "openai" | "claudeCode" } })
            }
          >
            <option value="openai">OpenAI API</option>
            <option value="claudeCode">Claude Code CLI</option>
          </select>
        </label>
        {settings.ai.provider === "openai" && (
          <label>
            OpenAI モデル:{" "}
            <input
              type="text"
              value={settings.ai.openaiModel ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, ai: { ...settings.ai, openaiModel: e.target.value } })
              }
              placeholder="gpt-4o-mini"
            />
          </label>
        )}
      </section>

      <section>
        <h3>自分の Backlog ユーザ (担当チケットの絞り込みに使用)</h3>
        <p className="hint">
          ここで設定したユーザ ID で「Backlog から取り込み」時に <code>assigneeId</code> フィルタが掛かります。未設定だと取り込みはスキップされます。
        </p>
        <div className="row">
          <input
            type="number"
            placeholder="自分の Backlog ユーザ ID (数値)"
            value={settings.backlog.self?.userId ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                backlog: {
                  ...settings.backlog,
                  self: e.target.value
                    ? {
                        userId: Number(e.target.value),
                        name: settings.backlog.self?.name,
                        loginId: settings.backlog.self?.loginId,
                      }
                    : undefined,
                },
              })
            }
          />
          <input
            type="text"
            placeholder="表示名 (任意)"
            value={settings.backlog.self?.name ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                backlog: {
                  ...settings.backlog,
                  self: settings.backlog.self
                    ? { ...settings.backlog.self, name: e.target.value }
                    : undefined,
                },
              })
            }
            disabled={!settings.backlog.self}
          />
          <button type="button" onClick={fetchMyself} disabled={pending} className="secondary-btn">
            自動取得
          </button>
          {settings.backlog.self && (
            <button type="button" onClick={clearMyself} disabled={pending} className="secondary-btn">
              クリア
            </button>
          )}
        </div>
      </section>

      <section>
        <h3>Backlog プロジェクト</h3>
        {settings.backlog.projects.map((p, i) => (
          <div key={i} className="row">
            <input
              type="number"
              placeholder="Project ID"
              value={p.projectId || ""}
              onChange={(e) => updateProject(i, "projectId", e.target.value)}
            />
            <input
              type="text"
              placeholder="プロジェクトキー (例: TM)"
              value={p.projectKey ?? ""}
              onChange={(e) => updateProject(i, "projectKey", e.target.value)}
            />
            <input
              type="text"
              placeholder="表示名"
              value={p.name ?? ""}
              onChange={(e) => updateProject(i, "name", e.target.value)}
            />
            <button type="button" onClick={() => removeProject(i)} className="secondary-btn">
              削除
            </button>
          </div>
        ))}
        <button type="button" onClick={addProject} className="secondary-btn">
          + プロジェクト追加
        </button>
      </section>

      <section>
        <h3>ステータスマッピング (「今日やる」着手時の遷移先)</h3>
        {settings.statusMapping.map((m, i) => (
          <div key={i} className="row">
            <input
              type="number"
              placeholder="Project ID"
              value={m.projectId || ""}
              onChange={(e) => updateMapping(i, "projectId", e.target.value)}
            />
            <input
              type="number"
              placeholder="「処理中」相当の Status ID"
              value={m.inProgressStatusId || ""}
              onChange={(e) => updateMapping(i, "inProgressStatusId", e.target.value)}
            />
            <button type="button" onClick={() => removeMapping(i)} className="secondary-btn">
              削除
            </button>
          </div>
        ))}
        <button type="button" onClick={addMapping} className="secondary-btn">
          + マッピング追加
        </button>
        <p className="hint">
          Status ID は Backlog の `/api/v2/projects/:projectId/statuses` で取得できる ID を指定してください。
        </p>
      </section>

      <div className="settings-actions">
        <button type="button" onClick={save} disabled={pending} className="primary-btn">
          {pending ? "保存中…" : "設定を保存"}
        </button>
      </div>
    </div>
  );
}
