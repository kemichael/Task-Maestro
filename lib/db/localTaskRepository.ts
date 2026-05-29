import "server-only";
import { getDb } from "./connection";
import { DatabaseError } from "../errors";
import type {
  LocalTask,
  LocalTaskInput,
  LocalTaskPatch,
  LocalTaskRow,
} from "../types/localTask";
import { isKanbanColumn, type LocalTaskStatus } from "../types/kanban";

function normalizeStatus(raw: string): LocalTaskStatus {
  return isKanbanColumn(raw) ? raw : "todo";
}

function toLocalTask(row: LocalTaskRow): LocalTask {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    dueDate: row.due_date ?? undefined,
    status: normalizeStatus(row.status),
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listLocalTasks(includeDone = false): LocalTask[] {
  try {
    const db = getDb();
    const where = includeDone ? "" : "WHERE status != 'done'";
    const rows = db
      .prepare<[], LocalTaskRow>(
        `SELECT * FROM local_task ${where} ORDER BY status = 'done', due_date IS NULL, due_date ASC, created_at ASC`,
      )
      .all();
    return rows.map(toLocalTask);
  } catch (error) {
    throw new DatabaseError("メモタスク一覧の取得に失敗", error);
  }
}

export function findLocalTaskById(id: number): LocalTask | undefined {
  try {
    const db = getDb();
    const row = db
      .prepare<[number], LocalTaskRow>("SELECT * FROM local_task WHERE id = ?")
      .get(id);
    return row ? toLocalTask(row) : undefined;
  } catch (error) {
    throw new DatabaseError("メモタスクの取得に失敗", error);
  }
}

export function insertLocalTask(input: LocalTaskInput): LocalTask {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const status: LocalTaskStatus = input.status ?? "todo";
    const completedAt = status === "done" ? now : null;
    const result = db
      .prepare(
        `INSERT INTO local_task (title, notes, due_date, status, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.title, input.notes ?? null, input.dueDate ?? null, status, completedAt, now, now);
    const created = findLocalTaskById(Number(result.lastInsertRowid));
    if (!created) throw new DatabaseError("作成直後のメモタスクが取得できませんでした");
    return created;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError("メモタスクの作成に失敗", error);
  }
}

export function updateLocalTask(id: number, patch: LocalTaskPatch): LocalTask | undefined {
  try {
    const db = getDb();
    const existing = findLocalTaskById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const nextTitle = patch.title !== undefined ? patch.title : existing.title;
    const nextNotes =
      patch.notes !== undefined ? (patch.notes === null ? null : patch.notes) : existing.notes ?? null;
    const nextDue =
      patch.dueDate !== undefined
        ? (patch.dueDate === null ? null : patch.dueDate)
        : existing.dueDate ?? null;

    let nextStatus: LocalTaskStatus = existing.status;
    if (patch.status !== undefined) nextStatus = patch.status;
    else if (patch.completed !== undefined) nextStatus = patch.completed ? "done" : "todo";

    const nextCompletedAt =
      nextStatus === "done"
        ? existing.completedAt ?? now
        : null;

    db.prepare(
      `UPDATE local_task
       SET title = ?, notes = ?, due_date = ?, status = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextTitle, nextNotes, nextDue, nextStatus, nextCompletedAt, now, id);

    return findLocalTaskById(id);
  } catch (error) {
    throw new DatabaseError("メモタスクの更新に失敗", error);
  }
}

export function deleteLocalTask(id: number): void {
  try {
    const db = getDb();
    db.prepare("DELETE FROM local_task WHERE id = ?").run(id);
  } catch (error) {
    throw new DatabaseError("メモタスクの削除に失敗", error);
  }
}
