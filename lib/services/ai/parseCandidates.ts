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

/**
 * AI が返しうる形のゆらぎを吸収して候補配列の形に寄せる。
 * - 配列ならそのまま
 * - { candidates: [...] } ならそのまま
 * - JSON モードで任意キーにラップされた場合 ({ tasks: [...] } 等) は最初の配列値を採用
 */
function coerceToCandidatesShape(json: unknown): unknown {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) return obj;
    const firstArray = Object.values(obj).find((v) => Array.isArray(v));
    if (firstArray) return firstArray;
  }
  return json;
}

/** AI の生出力文字列を検証済み `TicketCandidate[]` に変換する純粋関数 */
export function parseCandidates(raw: string): TicketCandidate[] {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch (error) {
    throw new AiProviderError("AI 出力が JSON として解釈できませんでした", error);
  }
  const result = extractionResultSchema.safeParse(coerceToCandidatesShape(json));
  if (!result.success) {
    throw new AiProviderError("AI 出力が期待する形式ではありません", result.error);
  }
  return normalizeCandidates(result.data);
}
