import type { TicketCandidate } from "../../types/ticket";
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
 * AI が返しうる形のゆらぎを吸収して候補の配列を取り出す。
 * - 配列ならそのまま
 * - { candidates: [...] } ならその配列
 * - 任意キーにラップされた配列 ({ tasks: [...] } 等) は最初の配列を採用
 * - title を持つ単一オブジェクトは 1 件として扱う
 */
function toArray(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) return obj.candidates;
    const firstArray = Object.values(obj).find((v) => Array.isArray(v));
    if (firstArray) return firstArray as unknown[];
    if (typeof obj.title === "string") return [obj];
  }
  return [];
}

const DUE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 期限文字列を YYYY-MM-DD に正規化する。
 * 解釈できない値 (「来週」など) は undefined を返し、候補全体は失敗させない。
 */
function normalizeDue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (DUE_RE.test(s)) return s;
  // YYYY/MM/DD・YYYY.MM.DD (1 桁月日も許容)
  const slash = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (slash) {
    const [, y, mo, d] = slash;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // ISO 日時の先頭日付 (2026-06-15T09:00:00 等)
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (iso) return iso[1];
  return undefined;
}

/** キー候補の中から最初の非空文字列を返す */
function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * AI の生出力文字列を `TicketCandidate[]` に変換する。
 * フィールド名のゆらぎ・不正な期限を吸収し、使える候補だけを残す寛容なパーサ。
 */
export function parseCandidates(raw: string): TicketCandidate[] {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch (error) {
    throw new AiProviderError("AI 出力が JSON として解釈できませんでした", error);
  }

  const arr = toArray(json);
  const candidates: TicketCandidate[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const title = pickString(obj, ["title", "task", "name", "summary"]);
    if (!title) continue;
    const body = pickString(obj, ["body", "description", "detail", "notes"]);
    const suggested_due = normalizeDue(obj.suggested_due ?? obj.due ?? obj.dueDate ?? obj.deadline);
    candidates.push({
      title,
      ...(body ? { body } : {}),
      ...(suggested_due ? { suggested_due } : {}),
    });
  }

  // 配列はあったのに title を持つ要素が 1 つも無い = 想定外の形式
  if (candidates.length === 0 && arr.length > 0) {
    throw new AiProviderError("AI 出力から有効なタスクを抽出できませんでした");
  }
  return candidates;
}
