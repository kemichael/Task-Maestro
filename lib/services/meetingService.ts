import "server-only";
import { listEvents } from "../clients/googleCalendar";
import { searchDocs } from "../clients/googleDrive";
import { getDocumentText } from "../clients/googleDocs";
import { upsertMeetingDoc, listMeetingDocs, findMeetingDocById } from "../db/meetingDocRepository";
import { extractCandidatesFromText } from "./aiExtractionService";
import { getAppSettings } from "../db/settingsRepository";
import { docIdFromAttachments, pickDriveMatch, type DriveFileLite } from "./meeting/linkMeetingDoc";
import type { CalendarEventAttachment } from "../types/calendar";
import type { MeetingDoc } from "../types/meeting";
import type { TicketCandidate } from "../types/ticket";
import { NotFoundError } from "../errors";

type DriveSearchFn = (nameContains: string) => Promise<DriveFileLite[]>;

interface EventLike {
  title: string;
  attachments?: CalendarEventAttachment[];
  start?: string;
}

/** 予定から documentId を解決する。添付優先、無ければ Drive 検索。検索関数を注入して純粋に保つ */
export async function resolveDocId(event: EventLike, search: DriveSearchFn): Promise<string | null> {
  const fromAtt = docIdFromAttachments(event.attachments ?? []);
  if (fromAtt) return fromAtt;
  const files = await search(event.title);
  return pickDriveMatch(event.title, files, event.start)?.id ?? null;
}

function docUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}

/**
 * 終了済み・自分参加の予定を走査し、議事録 Docs を紐付けて upsert する。
 * 過去 14 日分を対象とする。
 */
export async function detectMeetingDocs(): Promise<MeetingDoc[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const events = await listEvents(from.toISOString(), now.toISOString());
  for (const ev of events) {
    if (ev.attended === false) continue;
    const documentId = await resolveDocId({ title: ev.title, attachments: ev.attachments, start: ev.start }, searchDocs);
    if (!documentId) continue;
    upsertMeetingDoc({
      calendarEventId: ev.id,
      documentId,
      title: ev.title,
      occurredAt: ev.start,
      docUrl: docUrl(documentId),
    });
  }
  return listMeetingDocs(false);
}

const selfName = () => getAppSettings().backlog.self?.name;

/** 指定議事録の本文を取得し AI 抽出する */
export async function extractMeetingCandidates(meetingDocId: number): Promise<TicketCandidate[]> {
  const meeting = findMeetingDocById(meetingDocId);
  if (!meeting || !meeting.documentId) {
    throw new NotFoundError("議事録または紐づくドキュメントが見つかりません");
  }
  const text = await getDocumentText(meeting.documentId);
  return extractCandidatesFromText({
    text,
    sourceMeta: { kind: "meeting", ref: meeting.docUrl ?? meeting.documentId },
    selfName: selfName(),
  });
}
