import type { TicketCandidate } from "./ticket";

export interface MeetingDoc {
  id: number;
  calendarEventId: string;
  documentId?: string;
  title: string;
  occurredAt: string;
  docUrl?: string;
  candidates: TicketCandidate[];
  processedAt?: string;
}
