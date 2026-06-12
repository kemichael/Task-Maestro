export type GoogleEventColorId =
  | "1" | "2" | "3" | "4" | "5" | "6"
  | "7" | "8" | "9" | "10" | "11";

export interface CalendarEventAttachment {
  fileId?: string;
  fileUrl?: string;
  title?: string;
  mimeType?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  htmlLink?: string;
  colorId?: GoogleEventColorId;
  attachments?: CalendarEventAttachment[];
  /** 自分が参加者または主催者だったか (FR-002 の対象判定用) */
  attended?: boolean;
}

export interface CreateCalendarEventInput {
  title: string;
  start: string;
  end?: string;
  description?: string;
  colorId?: GoogleEventColorId;
}

export interface UpdateCalendarEventInput {
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  colorId?: GoogleEventColorId | null;
}
