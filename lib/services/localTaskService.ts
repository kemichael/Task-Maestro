import "server-only";
import {
  deleteLocalTask,
  insertLocalTask,
  listLocalTasks,
  updateLocalTask,
} from "../db/localTaskRepository";
import type { LocalTask, LocalTaskInput, LocalTaskPatch } from "../types/localTask";
import { todayJst } from "../utils/date";

export function getLocalTasksForToday(
  today: string = todayJst(),
): LocalTask[] {
  // 「完了」のみ除外、それ以外 (todo/in_progress/resolved) は今日のリストに残す
  // 期限なし or 期限 <= 今日 のものだけ
  return listLocalTasks(false).filter((task) => !task.dueDate || task.dueDate <= today);
}

export function listAllLocalTasks(includeDone = false): LocalTask[] {
  return listLocalTasks(includeDone);
}

export function createLocalTask(input: LocalTaskInput): LocalTask {
  return insertLocalTask(input);
}

export function patchLocalTask(id: number, patch: LocalTaskPatch): LocalTask | undefined {
  return updateLocalTask(id, patch);
}

export function removeLocalTask(id: number): void {
  deleteLocalTask(id);
}
