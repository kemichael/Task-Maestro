import "server-only";
import { google } from "googleapis";
import { getOAuth2Client } from "./googleAuth";
import { ExternalApiError } from "../errors";
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  GoogleEventColorId,
} from "../types/calendar";
import { logger } from "../logger";

const CALENDAR_ID = "primary";
const DEFAULT_EVENT_DURATION_MIN = 60;

function getCalendar() {
  return google.calendar({ version: "v3", auth: getOAuth2Client() });
}

function toCalendarEvent(
  api: NonNullable<Awaited<ReturnType<ReturnType<typeof getCalendar>["events"]["get"]>>["data"]>,
): CalendarEvent {
  const start = api.start?.dateTime ?? api.start?.date ?? "";
  const end = api.end?.dateTime ?? api.end?.date ?? "";
  const rawColorId = api.colorId ?? undefined;
  const colorId = isGoogleEventColorId(rawColorId) ? rawColorId : undefined;
  return {
    id: api.id ?? "",
    title: api.summary ?? "(無題)",
    start,
    end,
    description: api.description ?? undefined,
    htmlLink: api.htmlLink ?? undefined,
    colorId,
  };
}

function isGoogleEventColorId(v: string | undefined): v is GoogleEventColorId {
  if (!v) return false;
  return /^([1-9]|1[01])$/.test(v);
}

interface GoogleApiErrorShape {
  code?: number;
  message?: string;
  errors?: Array<{ reason?: string; message?: string; domain?: string }>;
  response?: { data?: { error?: { code?: number; message?: string; errors?: unknown[]; status?: string } } };
}

function mapGoogleError(error: unknown, op: string): ExternalApiError {
  const e = error as GoogleApiErrorShape;
  const status = e.code;
  const reasons = e.errors?.map((x) => x.reason).filter(Boolean).join(",") ?? "";
  const upstream = e.response?.data?.error;
  const upstreamMsg = upstream?.message ?? e.message ?? "";
  const upstreamStatus = upstream?.status ?? "";
  logger.warn(
    {
      op,
      status,
      reasons,
      upstreamStatus,
      upstreamMsg,
      message: e.message,
    },
    "Google Calendar API エラー",
  );
  const detail = [reasons, upstreamMsg].filter(Boolean).join(" | ");
  if (status === 401 || status === 403) {
    return new ExternalApiError(
      `Google Calendar の認証に失敗: ${op}${detail ? " (" + detail + ")" : ""}`,
      "auth",
      false,
      status,
      error,
    );
  }
  if (status === 404) {
    return new ExternalApiError(`Google Calendar イベントが見つかりません: ${op}`, "notFound", false, 404, error);
  }
  if (status === 429) {
    return new ExternalApiError(`Google Calendar のレート制限: ${op}`, "rateLimit", true, 429, error);
  }
  return new ExternalApiError(
    `Google Calendar API エラー: ${op} ${upstreamMsg}`,
    "unknown",
    false,
    status,
    error,
  );
}

export async function listEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  try {
    const calendar = getCalendar();
    const res = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });
    return (res.data.items ?? []).map(toCalendarEvent);
  } catch (error) {
    throw mapGoogleError(error, "listEvents");
  }
}

export async function createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
  try {
    const calendar = getCalendar();
    const startDate = new Date(input.start);
    const endDate = input.end
      ? new Date(input.end)
      : new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MIN * 60 * 1000);
    const requestBody: Record<string, unknown> = {
      summary: input.title,
      description: input.description,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
    };
    if (input.colorId !== undefined) {
      requestBody.colorId = input.colorId;
    }
    const res = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody,
    });
    if (!res.data) {
      throw new ExternalApiError("Google Calendar の予定作成レスポンスが空です", "unknown", false);
    }
    return toCalendarEvent(res.data);
  } catch (error) {
    throw mapGoogleError(error, "createEvent");
  }
}

export async function patchEvent(
  eventId: string,
  input: UpdateCalendarEventInput,
): Promise<CalendarEvent> {
  try {
    const calendar = getCalendar();
    const requestBody: Record<string, unknown> = {};
    if (input.title !== undefined) requestBody.summary = input.title;
    if (input.description !== undefined) requestBody.description = input.description;
    if (input.start !== undefined) {
      requestBody.start = { dateTime: new Date(input.start).toISOString() };
    }
    if (input.end !== undefined) {
      requestBody.end = { dateTime: new Date(input.end).toISOString() };
    }
    if (input.colorId !== undefined) {
      // null = Default 化 (Google API 側で colorId をクリア)
      requestBody.colorId = input.colorId;
    }
    const res = await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody,
    });
    if (!res.data) {
      throw new ExternalApiError("Google Calendar の予定更新レスポンスが空です", "unknown", false);
    }
    return toCalendarEvent(res.data);
  } catch (error) {
    throw mapGoogleError(error, "patchEvent");
  }
}

export async function deleteEvent(eventId: string): Promise<void> {
  try {
    const calendar = getCalendar();
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
  } catch (error) {
    throw mapGoogleError(error, "deleteEvent");
  }
}

logger.debug("Google Calendar client module loaded");
