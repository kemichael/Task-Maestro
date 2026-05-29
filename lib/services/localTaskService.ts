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
  _today: string = todayJst(),
): LocalTask[] {
  // 「完了」のみ除外、未完了 (todo/in_progress/resolved) は期限に関係なく全件表示。
  // 期限なし・期限切れ・今日・未来いずれも表示し、新規登録したタスクが視界から
  // 消えないようにする。並びは「期限なし末尾 → 期限昇順 → 作成昇順」 (リポジトリ側で固定)。
  return listLocalTasks(false);
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
