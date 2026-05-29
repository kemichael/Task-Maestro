export type AIProviderKind = "openai" | "claudeCode";

export interface AISettings {
  provider: AIProviderKind;
  openaiModel?: string;
}

export interface BacklogProjectSetting {
  projectId: number;
  projectKey?: string;
  name?: string;
}

export interface BacklogSelfIdentity {
  userId: number;
  name?: string;
  loginId?: string;
}

export interface StatusMapping {
  projectId: number;
  inProgressStatusId: number;
}

/**
 * 各プロジェクトについて、Backlog のステータス ID → カンバン列 (todo/in_progress/resolved/done) を割り当てる。
 * 設定画面で {Backlog プロジェクト} × {Backlog ステータス} の組ごとに 1 列を選ぶ。
 */
export interface KanbanProjectMapping {
  projectId: number;
  /** key は Backlog status_id (number)。値はカンバン列キー */
  columnByStatusId: Record<number, string>;
}

export interface SlackWorkspaceSetting {
  workspaceId: string;
  workspaceName?: string;
}

export interface AppSettings {
  ai: AISettings;
  backlog: {
    projects: BacklogProjectSetting[];
    self?: BacklogSelfIdentity;
  };
  slack: { workspaces: SlackWorkspaceSetting[] };
  statusMapping: StatusMapping[];
  kanban: {
    projects: KanbanProjectMapping[];
  };
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ai: { provider: "openai", openaiModel: "gpt-4o-mini" },
  backlog: { projects: [] },
  slack: { workspaces: [] },
  statusMapping: [],
  kanban: { projects: [] },
};

export type UserIdentityService = "slack" | "google" | "backlog";

export interface UserIdentity {
  service: UserIdentityService;
  identifier: string;
  displayName?: string;
}
