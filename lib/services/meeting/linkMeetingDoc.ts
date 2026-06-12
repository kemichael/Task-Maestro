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

/** Drive 検索結果から、予定タイトルを名前に含む候補を選ぶ。
 *  eventStart が与えられた場合は modifiedTime が実施日に最も近い候補を優先する。無ければ null */
export function pickDriveMatch(
  eventTitle: string,
  files: DriveFileLite[],
  eventStart?: string,
): DriveFileLite | null {
  const title = eventTitle.trim();
  if (!title) return null;
  const matches = files.filter((f) => f.name.includes(title));
  if (matches.length === 0) return null;
  if (!eventStart) return matches[0];
  const target = new Date(eventStart).getTime();
  if (Number.isNaN(target)) return matches[0];
  let best = matches[0];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const f of matches) {
    if (!f.modifiedTime) continue;
    const diff = Math.abs(new Date(f.modifiedTime).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = f;
    }
  }
  return best;
}
