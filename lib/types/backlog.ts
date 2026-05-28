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
