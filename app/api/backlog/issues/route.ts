import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createTicket } from "@/lib/services/backlogIssueService";
import { ticketDraftSchema } from "@/lib/validation/ticketSchema";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const draft = ticketDraftSchema.parse(json);
    const issue = await createTicket(draft);
    revalidatePath("/issues");
    revalidatePath("/");
    return ok(issue, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
