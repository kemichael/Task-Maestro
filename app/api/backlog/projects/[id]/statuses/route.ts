import { NextRequest } from "next/server";
import { listProjectStatuses } from "@/lib/clients/backlog";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const projectId = Number(id);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      return errorResponse(new Error("projectId が不正です"));
    }
    const statuses = await listProjectStatuses(projectId);
    return ok(statuses);
  } catch (error) {
    return errorResponse(error);
  }
}
