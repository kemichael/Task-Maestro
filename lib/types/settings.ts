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
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ai: { provider: "openai", openaiModel: "gpt-4o-mini" },
  backlog: { projects: [] },
  slack: { workspaces: [] },
  statusMapping: [],
};

export type UserIdentityService = "slack" | "google" | "backlog";

export interface UserIdentity {
  service: UserIdentityService;
  identifier: string;
  displayName?: string;
}
