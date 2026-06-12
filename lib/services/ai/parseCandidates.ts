import type { TicketCandidate } from "../../types/ticket";
import { extractionResultSchema, normalizeCandidates } from "../../validation/extractionSchema";
import { AiProviderError } from "../../errors";

/** ```json ... ``` フェンスや前後の余分なテキストを除去して JSON 本体を取り出す */
function stripFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  return start >= 0 && end >= start ? body.slice(start, end + 1) : body;
}

/** AI の生出力文字列を検証済み `TicketCandidate[]` に変換する純粋関数 */
export function parseCandidates(raw: string): TicketCandidate[] {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch (error) {
    throw new AiProviderError("AI 出力が JSON として解釈できませんでした", error);
  }
  const result = extractionResultSchema.safeParse(json);
  if (!result.success) {
    throw new AiProviderError("AI 出力が期待する形式ではありません", result.error);
  }
  return normalizeCandidates(result.data);
}
