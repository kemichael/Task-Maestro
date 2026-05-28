import { syncAllProjects } from "@/lib/services/backlogIssueService";
import { errorResponse, ok } from "@/lib/http/response";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await syncAllProjects();
    revalidatePath("/issues");
    revalidatePath("/");
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
