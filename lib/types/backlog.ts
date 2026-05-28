export interface BacklogIssueRef {
  id: number;
  name: string;
}

export interface BacklogIssue {
  id: number;
  projectId: number;
  issueKey: string;
  summary: string;
  description?: string;
  status: BacklogIssueRef;
  priority?: BacklogIssueRef;
  assignee?: BacklogIssueRef;
  dueDate?: string;
  updatedAt: string;
  todayFlag: boolean;
  parentIssueId?: number;
}

export interface BacklogIssueRow {
  id: number;
  project_id: number;
  issue_key: string;
  summary: string;
  description: string | null;
  status_id: number;
  status_name: string;
  priority_id: number | null;
  priority_name: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  due_date: string | null;
  updated_at: string;
  cached_at: string;
  today_flag: number;
  parent_issue_id: number | null;
}

export interface BacklogComment {
  id: number;
  content: string;
  createdUser: BacklogIssueRef;
  created: string;
}

export interface BacklogProjectStatus {
  id: number;
  projectId: number;
  name: string;
  color: string;
  displayOrder: number;
}

export interface BacklogUser {
  id: number;
  userId?: string;
  name: string;
  roleType?: number;
  lang?: string | null;
  mailAddress?: string;
}
