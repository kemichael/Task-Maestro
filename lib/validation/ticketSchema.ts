import { z } from "zod";

export const ticketDraftSchema = z.object({
  projectId: z.number().int().positive(),
  summary: z.string().min(1, "タイトルは必須です").max(255),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で指定してください")
    .optional(),
  assigneeId: z.number().int().positive().optional(),
  sourceMeta: z
    .object({
      kind: z.enum(["slack", "meeting", "document", "manual"]),
      ref: z.string(),
    })
    .optional(),
});

export type TicketDraftInput = z.infer<typeof ticketDraftSchema>;

export const patchIssueSchema = z.object({
  summary: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  statusId: z.number().int().positive().optional(),
  priorityId: z.number().int().positive().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
  commentBody: z.string().optional(),
});

export type PatchIssueInput = z.infer<typeof patchIssueSchema>;

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1).max(255),
  start: z.string().min(1),
  end: z.string().optional(),
  description: z.string().optional(),
});

export const calendarEventPatchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  description: z.string().optional(),
});
