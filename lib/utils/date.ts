/**
 * Backlog API は dueDate を ISO 8601 (例: "2025-11-11T00:00:00Z") で返すが、
 * HTML <input type="date"> は YYYY-MM-DD しか受け付けない。
 * 先頭 10 文字を切り出して date input 互換の形式に正規化する。
 */
export function normalizeDateForInput(iso: string | undefined | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}
