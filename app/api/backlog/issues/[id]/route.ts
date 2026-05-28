import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { updateTicket } from "@/lib/services/backlogIssueService";
import { patchIssueSchema } from "@/lib/validation/ticketSchema";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const issueId = Number(id);
    if (!Number.isFinite(issueId) || issueId <= 0) {
      return errorResponse(new Error("issueId が不正です"));
    }
    const json = await req.json();
    const patch = patchIssueSchema.parse(json);
    const issue = await updateTicket(issueId, patch);
    revalidatePath("/issues");
    revalidatePath("/");
    return ok(issue);
  } catch (error) {
    return errorResponse(error);
  }
}
