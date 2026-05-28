import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppSettings, saveAppSettings } from "@/lib/db/settingsRepository";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

const projectSchema = z.object({
  projectId: z.number().int().positive(),
  projectKey: z.string().optional(),
  name: z.string().optional(),
});

const statusMappingSchema = z.object({
  projectId: z.number().int().positive(),
  inProgressStatusId: z.number().int().positive(),
});

const workspaceSchema = z.object({
  workspaceId: z.string().min(1),
  workspaceName: z.string().optional(),
});

const settingsSchema = z.object({
  ai: z.object({
    provider: z.enum(["openai", "claudeCode"]),
    openaiModel: z.string().optional(),
  }),
  backlog: z.object({ projects: z.array(projectSchema) }),
  slack: z.object({ workspaces: z.array(workspaceSchema) }),
  statusMapping: z.array(statusMappingSchema),
});

export async function GET() {
  try {
    return ok(getAppSettings());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = settingsSchema.parse(json);
    saveAppSettings(parsed);
    revalidatePath("/settings");
    revalidatePath("/");
    return ok(parsed);
  } catch (error) {
    return errorResponse(error);
  }
}
