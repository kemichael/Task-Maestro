/**
 * Backlog API は dueDate を ISO 8601 (例: "2025-11-11T00:00:00Z") で返すが、
 * HTML <input type="date"> は YYYY-MM-DD しか受け付けない。
 * 先頭 10 文字を切り出して date input 互換の形式に正規化する。
 */
export function normalizeDateForInput(iso: string | undefined | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * UTC ISO 文字列 (または Date) を JST (UTC+9) の YYYY-MM-DD に変換する。
 * 例: "2026-05-29T20:00:00Z" (UTC) → JST 2026-05-30 早朝 → "2026-05-30"
 */
export function toJstDateString(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + JST_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** 「JST における今日」の YYYY-MM-DD を返す。 */
export function todayJst(): string {
  return toJstDateString(new Date());
}
