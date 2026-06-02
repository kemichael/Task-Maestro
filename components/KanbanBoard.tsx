"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  KanbanBoard as KanbanBoardData,
  KanbanCard,
} from "@/lib/services/kanbanService";
import type { KanbanProjectMapping } from "@/lib/types/settings";
import type { BacklogProjectStatus } from "@/lib/types/backlog";
import {
  KANBAN_COLUMNS,
  KANBAN_COLUMN_LABEL,
  type KanbanColumn,
} from "@/lib/types/kanban";
import { NotesHoverPopover } from "./NotesHoverPopover";
import {
  daysOverdueJst,
  isDueTodayJst,
  isOverdueJst,
  todayJst,
} from "@/lib/utils/date";

interface Props {
  board: KanbanBoardData;
  kanbanMappings: KanbanProjectMapping[];
}

interface BacklogConfirmState {
  card: Extract<KanbanCard, { kind: "backlog" }>;
  targetColumn: KanbanColumn;
  candidates: number[];
  /** Backlog から取得した、候補ステータスの { id, name } リスト (ラベル表示用) */
  candidateLabels?: Array<{ id: number; name: string }>;
  loading?: boolean;
  error?: string;
}

function cardKey(card: KanbanCard): string {
  return card.kind === "backlog"
    ? `b-${card.issue.id}`
    : `l-${card.task.id}`;
}

function cardId(card: KanbanCard): number {
  return card.kind === "backlog" ? card.issue.id : card.task.id;
}

function cardTitle(card: KanbanCard): string {
  return card.kind === "backlog"
    ? `${card.issue.issueKey}: ${card.issue.summary}`
    : card.task.title;
}

function cardDue(card: KanbanCard): string | undefined {
  return card.kind === "backlog" ? card.issue.dueDate : card.task.dueDate;
}

export function KanbanBoard({ board, kanbanMappings }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<KanbanColumn | null>(null);
  const [confirmState, setConfirmState] = useState<BacklogConfirmState | null>(null);

  // 期限切れ / 本日期限ハイライト用 JST 今日
  const today = todayJst();

  const mappingByProject = useMemo(
    () => new Map(kanbanMappings.map((m) => [m.projectId, m])),
    [kanbanMappings],
  );

  const candidateStatusIdsForColumn = useCallback(
    (projectId: number, column: KanbanColumn): number[] => {
      const mapping = mappingByProject.get(projectId);
      if (!mapping) return [];
      return Object.entries(mapping.columnByStatusId)
        .filter(([, col]) => col === column)
        .map(([sid]) => Number(sid))
        .filter((n) => Number.isFinite(n));
    },
    [mappingByProject],
  );

  const updateLocalStatus = useCallback(
    async (taskId: number, column: KanbanColumn) => {
      setError(null);
      setPending(true);
      try {
        const res = await fetch(`/api/local-tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: column }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `更新失敗 (${res.status})`);
        }
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const updateBacklogStatus = useCallback(
    async (issueId: number, statusId: number) => {
      setError(null);
      setPending(true);
      try {
        const res = await fetch(`/api/backlog/issues/${issueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statusId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Backlog 更新失敗 (${res.status})`);
        }
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const openConfirmModal = useCallback(
    async (
      card: Extract<KanbanCard, { kind: "backlog" }>,
      targetColumn: KanbanColumn,
      candidates: number[],
    ) => {
      setConfirmState({ card, targetColumn, candidates, loading: true });
      try {
        const res = await fetch(`/api/backlog/projects/${card.issue.projectId}/statuses`);
        if (!res.ok) throw new Error(`ステータス取得失敗 (${res.status})`);
        const allStatuses = (await res.json()) as BacklogProjectStatus[];
        const labels = candidates
          .map((id) => {
            const found = allStatuses.find((s) => s.id === id);
            return { id, name: found?.name ?? `#${id}` };
          });
        setConfirmState((s) => (s ? { ...s, candidateLabels: labels, loading: false } : s));
      } catch (e) {
        setConfirmState((s) =>
          s ? { ...s, loading: false, error: (e as Error).message } : s,
        );
      }
    },
    [],
  );

  const handleDrop = useCallback(
    async (column: KanbanColumn, e: React.DragEvent) => {
      e.preventDefault();
      setDragOverCol(null);
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;
      let payload: { kind: "backlog" | "local"; id: number; projectId?: number; currentStatusId?: number; currentColumn?: KanbanColumn };
      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }
      if (payload.kind === "local") {
        if (payload.currentColumn === column) return;
        await updateLocalStatus(payload.id, column);
        return;
      }
      // Backlog
      if (!payload.projectId) {
        setError("プロジェクト ID 不明のため遷移できません");
        return;
      }
      const candidates = candidateStatusIdsForColumn(payload.projectId, column);
      if (candidates.length === 0) {
        setError(
          `「${KANBAN_COLUMN_LABEL[column]}」列にマップされた Backlog ステータスがありません。設定画面で割り当ててください。`,
        );
        return;
      }
      // 既に同じステータスの場合は何もしない
      if (payload.currentStatusId && candidates.includes(payload.currentStatusId)) {
        if (payload.currentColumn === column) return;
      }
      if (candidates.length === 1) {
        await updateBacklogStatus(payload.id, candidates[0]);
        return;
      }
      // 複数候補 → 確認モーダル
      const card = findBacklogCard(board, payload.id);
      if (!card) {
        setError("対象チケットが見つかりません");
        return;
      }
      openConfirmModal(card, column, candidates);
    },
    [board, candidateStatusIdsForColumn, updateBacklogStatus, updateLocalStatus, openConfirmModal],
  );

  const handleDragStart = (e: React.DragEvent, card: KanbanCard) => {
    const payload =
      card.kind === "backlog"
        ? {
            kind: "backlog" as const,
            id: card.issue.id,
            projectId: card.issue.projectId,
            currentStatusId: card.issue.status.id,
            currentColumn: card.column,
          }
        : {
            kind: "local" as const,
            id: card.task.id,
            currentColumn: card.column,
          };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const confirmTransition = async (statusId: number) => {
    if (!confirmState) return;
    const issueId = confirmState.card.issue.id;
    setConfirmState(null);
    await updateBacklogStatus(issueId, statusId);
  };

  return (
    <div className="kanban-wrapper">
      {error && <div className="error-banner">{error}</div>}
      {pending && <div className="kanban-pending">更新中…</div>}
      <div className="kanban-board">
        {KANBAN_COLUMNS.map((col) => (
          <div
            key={col}
            className={`kanban-column${dragOverCol === col ? " drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverCol(col);
            }}
            onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
            onDrop={(e) => handleDrop(col, e)}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-title">
                <span className="cyber-label" style={{ marginRight: 6 }}>{"STAGE →"}</span>
                {KANBAN_COLUMN_LABEL[col]}
              </span>
              <span className="kanban-column-count">{board[col].length}</span>
            </div>
            <div className="kanban-column-body">
              {board[col].length === 0 ? (
                <div className="kanban-empty">(なし)</div>
              ) : (
                board[col].map((card) => {
                  // done 列 (完了済) は期限切れ強調しない
                  const due = cardDue(card);
                  const completed = card.column === "done";
                  const overdue = !completed && isOverdueJst(due, today);
                  const dueToday =
                    !completed && !overdue && isDueTodayJst(due, today);
                  const dueClass = overdue ? "is-overdue" : dueToday ? "is-due-today" : "";
                  return (
                  <article
                    key={cardKey(card)}
                    className={`kanban-card kanban-card-${card.kind} ${dueClass}`.trim()}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card)}
                    data-id={cardId(card)}
                  >
                    {card.kind === "backlog" ? (
                      <>
                        <div className="kanban-card-meta">
                          <span className="issue-key-chip">{card.issue.issueKey}</span>
                          <span className="kanban-card-status">
                            {card.issue.status.name}
                          </span>
                        </div>
                        <div className="kanban-card-title">{card.issue.summary}</div>
                      </>
                    ) : (
                      <>
                        <div className="kanban-card-meta">
                          <span className="kanban-local-chip">📝 メモ</span>
                        </div>
                        <div className="kanban-card-title">{card.task.title}</div>
                        {card.task.notes && (
                          <NotesHoverPopover
                            content={card.task.notes}
                            classPrefix="kanban-card-notes"
                          />
                        )}
                      </>
                    )}
                    {due && (
                      <div className={`kanban-card-due ${dueClass}`.trim()}>
                        {overdue ? "⚠️ " : dueToday ? "⏰ " : ""}📅 {due.slice(0, 10)}
                        {overdue && ` (${daysOverdueJst(due, today)}日超過)`}
                        {dueToday && " (本日)"}
                      </div>
                    )}
                  </article>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="modal-backdrop" onClick={() => setConfirmState(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>遷移先 Backlog ステータスを選択</h3>
            <p className="hint">
              「{confirmState.card.issue.issueKey}: {confirmState.card.issue.summary}」を「
              {KANBAN_COLUMN_LABEL[confirmState.targetColumn]}」列へ。
              この列には複数の Backlog ステータスがマップされています。
            </p>
            {confirmState.loading && <div>候補を取得中…</div>}
            {confirmState.error && <div className="error-banner">{confirmState.error}</div>}
            {confirmState.candidateLabels && (
              <ul className="confirm-candidates">
                {confirmState.candidateLabels.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => confirmTransition(c.id)}
                      disabled={pending}
                    >
                      {c.name} <span className="muted">#{c.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setConfirmState(null)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function findBacklogCard(
  board: KanbanBoardData,
  issueId: number,
): Extract<KanbanCard, { kind: "backlog" }> | undefined {
  for (const col of KANBAN_COLUMNS) {
    const found = board[col].find(
      (c): c is Extract<KanbanCard, { kind: "backlog" }> =>
        c.kind === "backlog" && c.issue.id === issueId,
    );
    if (found) return found;
  }
  return undefined;
}
