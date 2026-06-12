import type { CalendarEventAttachment } from "../../types/calendar";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

export interface DriveFileLite {
  id: string;
  name: string;
  modifiedTime?: string;
}

/** 予定の添付から Google Docs の fileId を取り出す。無ければ null */
export function docIdFromAttachments(attachments: CalendarEventAttachment[]): string | null {
  const doc = attachments.find((a) => a.mimeType === GOOGLE_DOC_MIME && a.fileId);
  return doc?.fileId ?? null;
}

/** Drive 検索結果から、予定タイトルを名前に含む最初の Docs を選ぶ。無ければ null */
export function pickDriveMatch(eventTitle: string, files: DriveFileLite[]): DriveFileLite | null {
  const title = eventTitle.trim();
  if (!title) return null;
  return files.find((f) => f.name.includes(title)) ?? null;
}
