import "server-only";
import { getDb } from "./connection";
import { DatabaseError } from "../errors";
import type { BacklogIssue, BacklogIssueRow } from "../types/backlog";

function toBacklogIssue(row: BacklogIssueRow): BacklogIssue {
  return {
    id: row.id,
    projectId: row.project_id,
    issueKey: row.issue_key,
    summary: row.summary,
    description: row.description ?? undefined,
    status: { id: row.status_id, name: row.status_name },
    priority:
      row.priority_id !== null && row.priority_name !== null
        ? { id: row.priority_id, name: row.priority_name }
        : undefined,
    assignee:
      row.assignee_id !== null && row.assignee_name !== null
        ? { id: row.assignee_id, name: row.assignee_name }
        : undefined,
    dueDate: row.due_date ?? undefined,
    updatedAt: row.updated_at,
    todayFlag: row.today_flag === 1,
  };
}

function upsertOne(issue: BacklogIssue): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO backlog_issue (
       id, project_id, issue_key, summary, description,
       status_id, status_name, priority_id, priority_name,
       assignee_id, assignee_name, due_date, updated_at, cached_at, today_flag
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT today_flag FROM backlog_issue WHERE id = ?), 0))
     ON CONFLICT(id) DO UPDATE SET
       project_id = excluded.project_id,
       issue_key = excluded.issue_key,
       summary = excluded.summary,
       description = excluded.description,
       status_id = excluded.status_id,
       status_name = excluded.status_name,
       priority_id = excluded.priority_id,
       priority_name = excluded.priority_name,
       assignee_id = excluded.assignee_id,
       assignee_name = excluded.assignee_name,
       due_date = excluded.due_date,
       updated_at = excluded.updated_at,
       cached_at = excluded.cached_at`,
  ).run(
    issue.id,
    issue.projectId,
    issue.issueKey,
    issue.summary,
    issue.description ?? null,
    issue.status.id,
    issue.status.name,
    issue.priority?.id ?? null,
    issue.priority?.name ?? null,
    issue.assignee?.id ?? null,
    issue.assignee?.name ?? null,
    issue.dueDate ?? null,
    issue.updatedAt,
    new Date().toISOString(),
    issue.id,
  );
}

export function upsertIssues(issues: BacklogIssue[]): {
  inserted: number;
  updated: number;
} {
  try {
    const db = getDb();
    const tx = db.transaction((items: BacklogIssue[]) => {
      let inserted = 0;
      let updated = 0;
      const exists = db.prepare<[number], { id: number }>("SELECT id FROM backlog_issue WHERE id = ?");
      for (const issue of items) {
        if (exists.get(issue.id)) updated++;
        else inserted++;
        upsertOne(issue);
      }
      return { inserted, updated };
    });
    return tx(issues);
  } catch (error) {
    throw new DatabaseError("チケットの保存に失敗", error);
  }
}

export interface ListIssuesFilter {
  projectIds?: number[];
  statusIds?: number[];
  assigneeIds?: number[];
}

export function findAll(filter: ListIssuesFilter = {}): BacklogIssue[] {
  try {
    const db = getDb();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.projectIds && filter.projectIds.length > 0) {
      conditions.push(`project_id IN (${filter.projectIds.map(() => "?").join(",")})`);
      params.push(...filter.projectIds);
    }
    if (filter.statusIds && filter.statusIds.length > 0) {
      conditions.push(`status_id IN (${filter.statusIds.map(() => "?").join(",")})`);
      params.push(...filter.statusIds);
    }
    if (filter.assigneeIds && filter.assigneeIds.length > 0) {
      conditions.push(`assignee_id IN (${filter.assigneeIds.map(() => "?").join(",")})`);
      params.push(...filter.assigneeIds);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db
      .prepare<typeof params, BacklogIssueRow>(
        `SELECT * FROM backlog_issue ${where} ORDER BY due_date IS NULL, due_date ASC, updated_at DESC`,
      )
      .all(...params);
    return rows.map(toBacklogIssue);
  } catch (error) {
    throw new DatabaseError("チケット一覧の取得に失敗", error);
  }
}

export function findById(id: number): BacklogIssue | undefined {
  try {
    const db = getDb();
    const row = db
      .prepare<[number], BacklogIssueRow>("SELECT * FROM backlog_issue WHERE id = ?")
      .get(id);
    return row ? toBacklogIssue(row) : undefined;
  } catch (error) {
    throw new DatabaseError("チケットの取得に失敗", error);
  }
}

export function findToday(today: string): BacklogIssue[] {
  try {
    const db = getDb();
    const rows = db
      .prepare<[string], BacklogIssueRow>(
        `SELECT * FROM backlog_issue
         WHERE today_flag = 1 OR (due_date IS NOT NULL AND due_date <= ?)
         ORDER BY due_date IS NULL, due_date ASC, updated_at DESC`,
      )
      .all(today);
    return rows.map(toBacklogIssue);
  } catch (error) {
    throw new DatabaseError("今日やるリストの取得に失敗", error);
  }
}

export function setTodayFlag(id: number, flag: boolean): void {
  try {
    const db = getDb();
    db.prepare("UPDATE backlog_issue SET today_flag = ? WHERE id = ?").run(flag ? 1 : 0, id);
  } catch (error) {
    throw new DatabaseError("today_flag の更新に失敗", error);
  }
}

export function deleteById(id: number): void {
  try {
    const db = getDb();
    db.prepare("DELETE FROM backlog_issue WHERE id = ?").run(id);
  } catch (error) {
    throw new DatabaseError("チケットの削除に失敗", error);
  }
}
