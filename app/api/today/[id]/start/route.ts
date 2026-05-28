import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { markStarted } from "@/lib/services/todayService";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const issueId = Number(id);
    if (!Number.isFinite(issueId) || issueId <= 0) {
      return errorResponse(new Error("issueId が不正です"));
    }
    const issue = await markStarted(issueId);
    revalidatePath("/");
    revalidatePath("/issues");
    return ok(issue);
  } catch (error) {
    return errorResponse(error);
  }
}
