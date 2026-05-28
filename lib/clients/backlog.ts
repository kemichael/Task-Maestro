import "server-only";
import { getEnv } from "../env";
import { fetchJson, withRetry } from "./_common";
import type { BacklogComment, BacklogIssue, BacklogProjectStatus, BacklogUser } from "../types/backlog";
import type { TicketDraft } from "../types/ticket";
import { logger } from "../logger";

interface BacklogApiIssue {
  id: number;
  projectId: number;
  issueKey: string;
  summary: string;
  description?: string;
  status: { id: number; name: string };
  priority?: { id: number; name: string };
  assignee?: { id: number; name: string };
  dueDate?: string;
  updated: string;
}

interface BacklogApiComment {
  id: number;
  content: string;
  createdUser: { id: number; name: string };
  created: string;
}

function getBacklogBaseUrl(): string {
  const env = getEnv();
  if (!env.BACKLOG_SPACE_DOMAIN || !env.BACKLOG_API_KEY) {
    throw new Error("Backlog の認証情報が未設定です (BACKLOG_SPACE_DOMAIN / BACKLOG_API_KEY)");
  }
  return `https://${env.BACKLOG_SPACE_DOMAIN}/api/v2`;
}

function withApiKey(url: string, params: Record<string, string | number | (string | number)[]> = {}): string {
  const env = getEnv();
  const u = new URL(url);
  u.searchParams.set("apiKey", env.BACKLOG_API_KEY!);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) u.searchParams.append(`${key}[]`, String(v));
    } else {
      u.searchParams.set(key, String(value));
    }
  }
  return u.toString();
}

function toBacklogIssue(api: BacklogApiIssue): BacklogIssue {
  return {
    id: api.id,
    projectId: api.projectId,
    issueKey: api.issueKey,
    summary: api.summary,
    description: api.description,
    status: api.status,
    priority: api.priority,
    assignee: api.assignee,
    dueDate: api.dueDate,
    updatedAt: api.updated,
    todayFlag: false,
  };
}

export interface ListIssuesParams {
  projectIds: number[];
  count?: number;
  offset?: number;
  statusIds?: number[];
  assigneeIds?: number[];
}

export async function listIssues(params: ListIssuesParams): Promise<BacklogIssue[]> {
  const base = getBacklogBaseUrl();
  const url = withApiKey(`${base}/issues`, {
    projectId: params.projectIds,
    count: params.count ?? 100,
    offset: params.offset ?? 0,
    ...(params.statusIds ? { statusId: params.statusIds } : {}),
    ...(params.assigneeIds ? { assigneeId: params.assigneeIds } : {}),
  });
  const data = await withRetry(
    () => fetchJson<BacklogApiIssue[]>(url, { service: "backlog" }),
    { service: "backlog" },
  );
  return data.map(toBacklogIssue);
}

export async function getMyself(): Promise<BacklogUser> {
  const base = getBacklogBaseUrl();
  const url = withApiKey(`${base}/users/myself`);
  const data = await withRetry(
    () => fetchJson<BacklogUser>(url, { service: "backlog" }),
    { service: "backlog" },
  );
  return data;
}

export interface CreateIssuePayload extends TicketDraft {}

export async function createIssue(payload: CreateIssuePayload): Promise<BacklogIssue> {
  const base = getBacklogBaseUrl();
  const url = withApiKey(`${base}/issues`);
  const body = new URLSearchParams();
  body.set("projectId", String(payload.projectId));
  body.set("summary", payload.summary);
  if (payload.description !== undefined) body.set("description", payload.description);
  if (payload.priority) {
    const priorityId = priorityNameToId(payload.priority);
    if (priorityId) body.set("priorityId", String(priorityId));
  }
  if (payload.dueDate) body.set("dueDate", payload.dueDate);
  if (payload.assigneeId !== undefined) body.set("assigneeId", String(payload.assigneeId));
  if (payload.categoryIds) {
    for (const id of payload.categoryIds) body.append("categoryId[]", String(id));
  }
  body.set("issueTypeId", "0"); // 必須項目、リポジトリ慣習として 0 でデフォルト課題種別

  const data = await withRetry(
    () =>
      fetchJson<BacklogApiIssue>(url, {
        service: "backlog",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }),
    { service: "backlog" },
  );
  return toBacklogIssue(data);
}

export interface PatchIssuePayload {
  summary?: string;
  description?: string;
  statusId?: number;
  priorityId?: number;
  dueDate?: string;
  assigneeId?: number | null;
  categoryIds?: number[];
}

export async function patchIssue(
  issueId: number,
  payload: PatchIssuePayload,
): Promise<BacklogIssue> {
  const base = getBacklogBaseUrl();
  const url = withApiKey(`${base}/issues/${issueId}`);
  const body = new URLSearchParams();
  if (payload.summary !== undefined) body.set("summary", payload.summary);
  if (payload.description !== undefined) body.set("description", payload.description);
  if (payload.statusId !== undefined) body.set("statusId", String(payload.statusId));
  if (payload.priorityId !== undefined) body.set("priorityId", String(payload.priorityId));
  if (payload.dueDate !== undefined) body.set("dueDate", payload.dueDate);
  if (payload.assigneeId !== undefined) {
    body.set("assigneeId", payload.assigneeId === null ? "" : String(payload.assigneeId));
  }
  if (payload.categoryIds) {
    for (const id of payload.categoryIds) body.append("categoryId[]", String(id));
  }

  const data = await withRetry(
    () =>
      fetchJson<BacklogApiIssue>(url, {
        service: "backlog",
        method: "PATCH",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }),
    { service: "backlog" },
  );
  return toBacklogIssue(data);
}

export async function addComment(issueId: number, content: string): Promise<BacklogComment> {
  const base = getBacklogBaseUrl();
  const url = withApiKey(`${base}/issues/${issueId}/comments`);
  const body = new URLSearchParams({ content });
  const data = await withRetry(
    () =>
      fetchJson<BacklogApiComment>(url, {
        service: "backlog",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }),
    { service: "backlog" },
  );
  return {
    id: data.id,
    content: data.content,
    createdUser: data.createdUser,
    created: data.created,
  };
}

export async function listProjectStatuses(projectId: number): Promise<BacklogProjectStatus[]> {
  const base = getBacklogBaseUrl();
  const url = withApiKey(`${base}/projects/${projectId}/statuses`);
  const data = await withRetry(
    () => fetchJson<BacklogProjectStatus[]>(url, { service: "backlog" }),
    { service: "backlog" },
  );
  return data;
}

function priorityNameToId(priority: "low" | "normal" | "high"): number | undefined {
  // Backlog の標準優先度 ID (2=高, 3=中, 4=低)
  switch (priority) {
    case "high":
      return 2;
    case "normal":
      return 3;
    case "low":
      return 4;
    default:
      return undefined;
  }
}

logger.debug("Backlog client module loaded");
