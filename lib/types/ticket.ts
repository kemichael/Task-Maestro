export type TicketPriority = "low" | "normal" | "high";

export interface TicketSourceMeta {
  kind: "slack" | "meeting" | "document" | "manual";
  ref: string;
}

export interface TicketDraft {
  projectId: number;
  summary: string;
  description?: string;
  priority?: TicketPriority;
  categoryIds?: number[];
  dueDate?: string;
  assigneeId?: number;
  sourceMeta?: TicketSourceMeta;
}

export interface TicketCandidate {
  title: string;
  body?: string;
  suggested_due?: string;
}
