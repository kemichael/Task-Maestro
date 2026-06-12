import { z } from "zod";
import type { TicketCandidate } from "../types/ticket";

export const ticketCandidateSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  suggested_due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const extractionResultSchema = z.union([
  z.array(ticketCandidateSchema),
  z.object({ candidates: z.array(ticketCandidateSchema) }),
]);

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/** union の両形式を `TicketCandidate[]` に正規化する */
export function normalizeCandidates(result: ExtractionResult): TicketCandidate[] {
  return Array.isArray(result) ? result : result.candidates;
}
