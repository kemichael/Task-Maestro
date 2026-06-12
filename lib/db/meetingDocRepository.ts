import "server-only";
import { getDb } from "./connection";
import { DatabaseError } from "../errors";
import type { MeetingDocRow, MeetingDocUpsert } from "../types/meetingRow";
import type { MeetingDoc } from "../types/meeting";

function toMeetingDoc(row: MeetingDocRow): MeetingDoc {
  return {
    id: row.id,
    calendarEventId: row.calendar_event_id,
    documentId: row.document_id ?? undefined,
    title: row.title,
    occurredAt: row.occurred_at,
    docUrl: row.doc_url ?? undefined,
    candidates: [],
    processedAt: row.processed_at ?? undefined,
  };
}

export function findMeetingDocById(id: number): MeetingDoc | undefined {
  try {
    const row = getDb()
      .prepare<[number], MeetingDocRow>("SELECT * FROM meeting_doc WHERE id = ?")
      .get(id);
    return row ? toMeetingDoc(row) : undefined;
  } catch (error) {
    throw new DatabaseError("議事録の取得に失敗", error);
  }
}

export function listMeetingDocs(includeProcessed = false): MeetingDoc[] {
  try {
    const where = includeProcessed ? "" : "WHERE processed_at IS NULL";
    const rows = getDb()
      .prepare<[], MeetingDocRow>(`SELECT * FROM meeting_doc ${where} ORDER BY occurred_at DESC`)
      .all();
    return rows.map(toMeetingDoc);
  } catch (error) {
    throw new DatabaseError("議事録一覧の取得に失敗", error);
  }
}

export function upsertMeetingDoc(input: MeetingDocUpsert): MeetingDoc {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO meeting_doc (calendar_event_id, document_id, title, occurred_at, doc_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(calendar_event_id) DO UPDATE SET
         document_id = excluded.document_id,
         title = excluded.title,
         occurred_at = excluded.occurred_at,
         doc_url = excluded.doc_url,
         updated_at = excluded.updated_at`,
    ).run(
      input.calendarEventId,
      input.documentId ?? null,
      input.title,
      input.occurredAt,
      input.docUrl ?? null,
      now,
      now,
    );
    const row = db
      .prepare<[string], MeetingDocRow>("SELECT * FROM meeting_doc WHERE calendar_event_id = ?")
      .get(input.calendarEventId);
    if (!row) throw new DatabaseError("upsert 直後の議事録が取得できませんでした");
    return toMeetingDoc(row);
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError("議事録の保存に失敗", error);
  }
}

export function markMeetingDocProcessed(id: number): void {
  try {
    const now = new Date().toISOString();
    getDb()
      .prepare("UPDATE meeting_doc SET processed_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, id);
  } catch (error) {
    throw new DatabaseError("議事録の処理済みマークに失敗", error);
  }
}
