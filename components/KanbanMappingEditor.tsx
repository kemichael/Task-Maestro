"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  BacklogProjectSetting,
  KanbanProjectMapping,
} from "@/lib/types/settings";
import type { BacklogProjectStatus } from "@/lib/types/backlog";
import {
  KANBAN_COLUMNS,
  KANBAN_COLUMN_LABEL,
  defaultColumnForBacklogStatusId,
  isKanbanColumn,
  type KanbanColumn,
} from "@/lib/types/kanban";

interface Props {
  projects: BacklogProjectSetting[];
  mappings: KanbanProjectMapping[];
  onChange: (mappings: KanbanProjectMapping[]) => void;
}

type StatusesState = Record<
  number,
  { loading: boolean; statuses?: BacklogProjectStatus[]; error?: string }
>;

const UNASSIGNED = "";

export function KanbanMappingEditor({ projects, mappings, onChange }: Props) {
  const [statuses, setStatuses] = useState<StatusesState>({});

  const mappingByProject = useMemo(
    () => new Map(mappings.map((m) => [m.projectId, m])),
    [mappings],
  );

  const updateMapping = useCallback(
    (projectId: number, updater: (cur: Record<number, string>) => Record<number, string>) => {
      const existing = mappingByProject.get(projectId);
      const nextColumns = updater(existing?.columnByStatusId ?? {});
      const next: KanbanProjectMapping = { projectId, columnByStatusId: nextColumns };
      const others = mappings.filter((m) => m.projectId !== projectId);
      onChange([...others, next]);
    },
    [mappings, mappingByProject, onChange],
  );

  const fetchStatuses = useCallback(async (projectId: number) => {
    setStatuses((s) => ({ ...s, [projectId]: { loading: true } }));
    try {
      const res = await fetch(`/api/backlog/projects/${projectId}/statuses`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `ステータス取得失敗 (${res.status})`);
      }
      const data = (await res.json()) as BacklogProjectStatus[];
      setStatuses((s) => ({ ...s, [projectId]: { loading: false, statuses: data } }));
    } catch (e) {
      setStatuses((s) => ({
        ...s,
        [projectId]: { loading: false, error: (e as Error).message },
      }));
    }
  }, []);

  const applyDefaults = useCallback(
    (projectId: number, fetched: BacklogProjectStatus[]) => {
      updateMapping(projectId, (cur) => {
        const next = { ...cur };
        for (const st of fetched) {
          if (!next[st.id]) {
            const def = defaultColumnForBacklogStatusId(st.id);
            if (def) next[st.id] = def;
          }
        }
        return next;
      });
    },
    [updateMapping],
  );

  if (projects.length === 0) {
    return (
      <p className="hint">
        まず「Backlog プロジェクト」セクションでプロジェクトを追加してください。
      </p>
    );
  }

  return (
    <div className="kanban-mapping-editor">
      {projects.map((p) => {
        const projectId = p.projectId;
        if (!projectId) return null;
        const label = p.name ?? p.projectKey ?? `Project ${projectId}`;
        const state = statuses[projectId];
        const mapping = mappingByProject.get(projectId);
        const columnMap = mapping?.columnByStatusId ?? {};

        return (
          <div key={projectId} className="kanban-mapping-project">
            <div className="kanban-mapping-project-header">
              <strong>{label}</strong>
              <span className="muted">#{projectId}</span>
              <div className="spacer" />
              <button
                type="button"
                className="secondary-btn"
                onClick={() => fetchStatuses(projectId)}
                disabled={state?.loading}
              >
                {state?.loading
                  ? "取得中…"
                  : state?.statuses
                    ? "ステータス再取得"
                    : "Backlog からステータス取得"}
              </button>
              {state?.statuses && state.statuses.length > 0 && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => applyDefaults(projectId, state.statuses!)}
                  title="標準 ID (1=未対応/2=処理中/3=処理済み/4=完了) を自動で割り当て"
                >
                  デフォルト推定
                </button>
              )}
            </div>
            {state?.error && <div className="error-banner">{state.error}</div>}
            {state?.statuses && (
              <table className="kanban-mapping-table">
                <thead>
                  <tr>
                    <th>Backlog ステータス</th>
                    <th>ID</th>
                    <th>カンバン列</th>
                  </tr>
                </thead>
                <tbody>
                  {state.statuses.map((st) => {
                    const current = columnMap[st.id] ?? UNASSIGNED;
                    return (
                      <tr key={st.id}>
                        <td>
                          <span
                            className="status-swatch"
                            style={{ background: st.color }}
                            aria-hidden
                          />
                          {st.name}
                        </td>
                        <td className="muted">{st.id}</td>
                        <td>
                          <select
                            value={current}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateMapping(projectId, (cur) => {
                                const next = { ...cur };
                                if (v === UNASSIGNED) delete next[st.id];
                                else if (isKanbanColumn(v)) next[st.id] = v;
                                return next;
                              });
                            }}
                          >
                            <option value={UNASSIGNED}>(未割当: 表示しない)</option>
                            {KANBAN_COLUMNS.map((col: KanbanColumn) => (
                              <option key={col} value={col}>
                                {KANBAN_COLUMN_LABEL[col]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
