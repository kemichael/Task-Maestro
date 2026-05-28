import { NextRequest } from "next/server";
import { z } from "zod";
import { createEvent, listEvents } from "@/lib/clients/googleCalendar";
import { calendarEventCreateSchema } from "@/lib/validation/ticketSchema";
import { errorResponse, ok } from "@/lib/http/response";
import { getEnv } from "@/lib/env";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const listEventsQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const createEventBodySchema = calendarEventCreateSchema.extend({
  // チケット由来のドロップ時に渡される。BD-006 業務ルール「説明欄にチケット URL を埋め込む」を満たすため
  issueKey: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { from, to } = listEventsQuerySchema.parse({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    const events = await listEvents(from, to);
    return ok(events);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { issueKey, description, ...rest } = createEventBodySchema.parse(json);

    let mergedDescription = description ?? "";
    if (issueKey) {
      const env = getEnv();
      if (!env.BACKLOG_SPACE_DOMAIN) {
        throw new ValidationError("BACKLOG_SPACE_DOMAIN が未設定のためチケット URL を生成できません");
      }
      const issueUrl = `https://${env.BACKLOG_SPACE_DOMAIN}/view/${issueKey}`;
      mergedDescription = mergedDescription ? `${mergedDescription}\n\n${issueUrl}` : issueUrl;
    }

    const event = await createEvent({
      ...rest,
      description: mergedDescription || undefined,
    });
    return ok(event, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
