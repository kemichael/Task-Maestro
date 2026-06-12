export interface MeetingDocRow {
  id: number;
  calendar_event_id: string;
  document_id: string | null;
  title: string;
  occurred_at: string;
  doc_url: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 検出時に upsert する入力 (候補は永続化しない) */
export interface MeetingDocUpsert {
  calendarEventId: string;
  documentId?: string;
  title: string;
  occurredAt: string;
  docUrl?: string;
}
