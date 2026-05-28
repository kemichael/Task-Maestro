import { NextRequest } from "next/server";
import { createEvent, listEvents } from "@/lib/clients/googleCalendar";
import { calendarEventCreateSchema } from "@/lib/validation/ticketSchema";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) {
      return errorResponse(new Error("from / to クエリパラメータが必要です"));
    }
    const events = await listEvents(from, to);
    return ok(events);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = calendarEventCreateSchema.parse(json);
    const event = await createEvent(input);
    return ok(event, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
