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

/**
 * dueDate が JST 今日より過去か (= 期限切れ) を判定する。
 * dueDate は ISO 8601 でも YYYY-MM-DD でも先頭 10 文字を見るだけなので両対応。
 */
export function isOverdueJst(
  dueDate: string | undefined | null,
  today: string = todayJst(),
): boolean {
  if (!dueDate) return false;
  return dueDate.slice(0, 10) < today;
}

/** dueDate が JST 今日と同じ (= 本日期限) かを判定する。 */
export function isDueTodayJst(
  dueDate: string | undefined | null,
  today: string = todayJst(),
): boolean {
  if (!dueDate) return false;
  return dueDate.slice(0, 10) === today;
}

/**
 * 期限が JST 今日より何日過去かを返す。期限切れでなければ 0。
 * 例: dueDate=2026-05-29, today=2026-06-01 → 3
 */
export function daysOverdueJst(
  dueDate: string | undefined | null,
  today: string = todayJst(),
): number {
  if (!dueDate) return 0;
  const d = dueDate.slice(0, 10);
  if (d >= today) return 0;
  const dueMs = Date.parse(`${d}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(dueMs) || Number.isNaN(todayMs)) return 0;
  return Math.floor((todayMs - dueMs) / (24 * 60 * 60 * 1000));
}
