import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toggleTodayFlag } from "@/lib/services/todayService";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

const schema = z.object({ flag: z.boolean() });

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
    const { flag } = schema.parse(json);
    toggleTodayFlag(issueId, flag);
    revalidatePath("/");
    return ok({ id: issueId, todayFlag: flag });
  } catch (error) {
    return errorResponse(error);
  }
}
