import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createLocalTask,
  listAllLocalTasks,
} from "@/lib/services/localTaskService";
import { errorResponse, ok } from "@/lib/http/response";
import { KANBAN_COLUMNS } from "@/lib/types/kanban";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1, "タイトルは必須です").max(200),
  notes: z.string().max(20000).optional().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で指定してください")
    .optional()
    .nullable(),
  status: z.enum(KANBAN_COLUMNS).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const includeCompleted = req.nextUrl.searchParams.get("includeCompleted") === "1";
    return ok(listAllLocalTasks(includeCompleted));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const input = createSchema.parse(json);
    const created = createLocalTask({
      title: input.title,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      status: input.status,
    });
    revalidatePath("/");
    revalidatePath("/kanban");
    return ok(created, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
