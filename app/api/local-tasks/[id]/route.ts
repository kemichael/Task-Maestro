import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  patchLocalTask,
  removeLocalTask,
} from "@/lib/services/localTaskService";
import { errorResponse, ok } from "@/lib/http/response";
import { NotFoundError } from "@/lib/errors";
import { KANBAN_COLUMNS } from "@/lib/types/kanban";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(20000).optional().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で指定してください")
    .optional()
    .nullable(),
  status: z.enum(KANBAN_COLUMNS).optional(),
  completed: z.boolean().optional(),
});

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("id が不正です");
  }
  return id;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const taskId = parseId(id);
    const json = await req.json();
    const patch = patchSchema.parse(json);
    const updated = patchLocalTask(taskId, patch);
    if (!updated) throw new NotFoundError(`メモタスク ${taskId} が見つかりません`);
    revalidatePath("/");
    revalidatePath("/kanban");
    return ok(updated);
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
    const taskId = parseId(id);
    removeLocalTask(taskId);
    revalidatePath("/");
    revalidatePath("/kanban");
    return ok({ id: taskId, deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
