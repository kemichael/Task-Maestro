import { NextRequest } from "next/server";
import { z } from "zod";
import { addComment } from "@/lib/clients/backlog";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

const commentSchema = z.object({ body: z.string().min(1) });

export async function POST(
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
    const { body } = commentSchema.parse(json);
    const comment = await addComment(issueId, body);
    return ok(comment, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
