export type GoogleEventColorId =
  | "1" | "2" | "3" | "4" | "5" | "6"
  | "7" | "8" | "9" | "10" | "11";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  htmlLink?: string;
  colorId?: GoogleEventColorId;
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
