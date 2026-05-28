export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  htmlLink?: string;
}

export interface CreateCalendarEventInput {
  title: string;
  start: string;
  end?: string;
  description?: string;
}

export interface UpdateCalendarEventInput {
  title?: string;
  start?: string;
  end?: string;
  description?: string;
}
