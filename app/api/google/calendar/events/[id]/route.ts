import { NextRequest, NextResponse } from "next/server";
import { deleteEvent, patchEvent } from "@/lib/clients/googleCalendar";
import { calendarEventPatchSchema } from "@/lib/validation/ticketSchema";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const json = await req.json();
    const input = calendarEventPatchSchema.parse(json);
    const event = await patchEvent(id, input);
    return ok(event);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteEvent(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
