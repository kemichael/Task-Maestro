import type { LocalTaskStatus } from "./kanban";

export interface LocalTask {
  id: number;
  title: string;
  notes?: string;
  dueDate?: string;
  status: LocalTaskStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalTaskRow {
  id: number;
  title: string;
  notes: string | null;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalTaskInput {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  status?: LocalTaskStatus;
}

export interface LocalTaskPatch {
  title?: string;
  notes?: string | null;
  dueDate?: string | null;
  status?: LocalTaskStatus;
  /** 互換用: true で 'done' / false で 'todo' に遷移させる旧 API */
  completed?: boolean;
}
