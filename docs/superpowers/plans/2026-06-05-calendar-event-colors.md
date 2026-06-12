# カレンダーイベント色対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Calendar の Event Colors (11 色) をアプリのカレンダー UI 上に表示し、編集モーダル経由でアプリからも色変更を Google 側に反映できるようにする。

**Architecture:** FullCalendar の `events` ロード時に `colorId` を Google 公式 11 色の RGB にマップして `backgroundColor`/`borderColor`/`textColor` を注入する。イベントクリックは編集モーダル (`EventEditModal`) を開き、`PATCH /api/google/calendar/events/[id]` 経由で `colorId` を含むフィールドを更新する。`colorId: null` を送ると Google 既定色にリセットされる。

**Tech Stack:** Next.js 15 (App Router) / React 19 / TypeScript / FullCalendar v6 / googleapis v144 / Zod / Vitest

**Reference Spec:** `docs/superpowers/specs/2026-06-05-calendar-event-colors-design.md`

---

## File Structure

| 操作 | パス | 責務 |
|------|------|------|
| 新規 | `lib/constants/googleEventColors.ts` | Google 公式 11 色定数 + Default + `resolveEventColor()` |
| 修正 | `lib/types/calendar.ts` | `CalendarEvent` / `Create...` / `Update...` に `colorId` 追加 |
| 修正 | `lib/clients/googleCalendar.ts` | `toCalendarEvent` で colorId 抽出、`createEvent`/`patchEvent` で colorId 送信、null で Default 化 |
| 修正 | `lib/validation/ticketSchema.ts` | `calendarEventCreateSchema` に colorId、`calendarEventPatchSchema` に colorId (nullable) |
| 修正 | `app/api/google/calendar/events/route.ts` | POST: colorId をそのまま createEvent に渡す |
| 修正 | `app/api/google/calendar/events/[id]/route.ts` | PATCH: 変更なし (新 schema は既に受信済) |
| 新規 | `components/EventEditModal.tsx` | タイトル/時刻/色/説明 編集、削除 (2 段階)、Google で開く |
| 修正 | `components/CalendarPane.tsx` | 色注入、`window.confirm` 削除、モーダル統合 |
| 修正 | `app/globals.css` | モーダル + 色丸ボタンのスタイル |
| 新規 | `tests/lib/googleEventColors.test.ts` | 定数の整合性 + `resolveEventColor()` |
| 新規 | `tests/clients/googleCalendar.colorId.test.ts` | client の colorId 入出力 |
| 修正 | `tests/validation/ticketSchema.test.ts` | colorId バリデーション追加 |

---

## Task 1: Google Event Colors 定数

**Files:**
- Create: `lib/constants/googleEventColors.ts`
- Test: `tests/lib/googleEventColors.test.ts`

- [ ] **Step 1.1: 失敗するテストを書く**

`tests/lib/googleEventColors.test.ts` を作成：

```ts
import { describe, expect, it } from "vitest";
import {
  GOOGLE_EVENT_COLORS,
  DEFAULT_CALENDAR_COLOR,
  resolveEventColor,
} from "@/lib/constants/googleEventColors";

describe("GOOGLE_EVENT_COLORS", () => {
  it("11 色を含む", () => {
    expect(GOOGLE_EVENT_COLORS).toHaveLength(11);
  });

  it("id が '1' から '11' まで連番", () => {
    expect(GOOGLE_EVENT_COLORS.map((c) => c.id)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
    ]);
  });

  it("各色は background / foreground / name を持つ", () => {
    for (const c of GOOGLE_EVENT_COLORS) {
      expect(c.name).toMatch(/.+/);
      expect(c.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.foreground).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("resolveEventColor", () => {
  it("colorId なしは DEFAULT_CALENDAR_COLOR", () => {
    expect(resolveEventColor(undefined)).toBe(DEFAULT_CALENDAR_COLOR);
  });

  it("colorId='7' で Peacock を返す", () => {
    const c = resolveEventColor("7");
    expect(c.background).toBe("#039be5");
  });

  it("範囲外 colorId は DEFAULT を返す (型で防がれてもガード)", () => {
    // @ts-expect-error 範囲外を意図的に渡す
    const c = resolveEventColor("99");
    expect(c).toBe(DEFAULT_CALENDAR_COLOR);
  });
});
```

- [ ] **Step 1.2: テストを実行して失敗を確認**

Run: `npm test -- googleEventColors`
Expected: FAIL — `Cannot find module '@/lib/constants/googleEventColors'`

- [ ] **Step 1.3: 実装する**

`lib/constants/googleEventColors.ts` を作成：

```ts
import type { GoogleEventColorId } from "@/lib/types/calendar";

export interface GoogleEventColor {
  id: GoogleEventColorId;
  name: string;
  background: string;
  foreground: string;
}

export const GOOGLE_EVENT_COLORS: readonly GoogleEventColor[] = [
  { id: "1",  name: "Lavender",  background: "#7986cb", foreground: "#ffffff" },
  { id: "2",  name: "Sage",      background: "#33b679", foreground: "#ffffff" },
  { id: "3",  name: "Grape",     background: "#8e24aa", foreground: "#ffffff" },
  { id: "4",  name: "Flamingo",  background: "#e67c73", foreground: "#ffffff" },
  { id: "5",  name: "Banana",    background: "#f6c026", foreground: "#1d1d1d" },
  { id: "6",  name: "Tangerine", background: "#f5511d", foreground: "#ffffff" },
  { id: "7",  name: "Peacock",   background: "#039be5", foreground: "#ffffff" },
  { id: "8",  name: "Graphite",  background: "#616161", foreground: "#ffffff" },
  { id: "9",  name: "Blueberry", background: "#3f51b5", foreground: "#ffffff" },
  { id: "10", name: "Basil",     background: "#0b8043", foreground: "#ffffff" },
  { id: "11", name: "Tomato",    background: "#d60000", foreground: "#ffffff" },
];

export const DEFAULT_CALENDAR_COLOR = {
  background: "#039be5",
  foreground: "#ffffff",
} as const;

export function resolveEventColor(
  colorId: GoogleEventColorId | undefined,
): { background: string; foreground: string } {
  if (!colorId) return DEFAULT_CALENDAR_COLOR;
  const found = GOOGLE_EVENT_COLORS.find((c) => c.id === colorId);
  return found ?? DEFAULT_CALENDAR_COLOR;
}
```

> 注: `GoogleEventColorId` 型は次の Task 2 で `lib/types/calendar.ts` に定義する。型エラーが出るが Task 2 完了後に解消する想定。`tsc --noEmit` は Task 2 完了後に実行する。

- [ ] **Step 1.4: テスト実行 (一旦コミット保留)**

Task 2 で型を入れるまで一旦テストは赤のままでよい。先に Task 2 に進む。

---

## Task 2: CalendarEvent 型に colorId を追加

**Files:**
- Modify: `lib/types/calendar.ts`

- [ ] **Step 2.1: 既存ファイルを Read で読む**

`lib/types/calendar.ts` の現状を確認 (CalendarEvent, CreateCalendarEventInput, UpdateCalendarEventInput が定義されている)。

- [ ] **Step 2.2: 型を拡張**

`lib/types/calendar.ts` を以下に書き換え：

```ts
export type GoogleEventColorId =
  | "1" | "2" | "3" | "4" | "5" | "6"
  | "7" | "8" | "9" | "10" | "11";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  htmlLink?: string;
  colorId?: GoogleEventColorId;
}

export interface CreateCalendarEventInput {
  title: string;
  start: string;
  end?: string;
  description?: string;
  colorId?: GoogleEventColorId;
}

export interface UpdateCalendarEventInput {
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  colorId?: GoogleEventColorId | null;
}
```

- [ ] **Step 2.3: 型チェック + Task 1 のテストを再実行**

Run: `npm run typecheck`
Expected: PASS

Run: `npm test -- googleEventColors`
Expected: PASS (3 テスト × describe 2 つ = 6 テスト全部緑)

- [ ] **Step 2.4: コミット**

```bash
git add lib/constants/googleEventColors.ts lib/types/calendar.ts tests/lib/googleEventColors.test.ts
git commit -m "feat: Google Calendar Event Colors 定数と型を追加"
```

---

## Task 3: Zod schema 拡張

**Files:**
- Modify: `lib/validation/ticketSchema.ts`
- Modify: `tests/validation/ticketSchema.test.ts`

- [ ] **Step 3.1: 失敗するテストを追加**

`tests/validation/ticketSchema.test.ts` の末尾に以下の describe を追加：

```ts
import {
  calendarEventCreateSchema,
  calendarEventPatchSchema,
} from "@/lib/validation/ticketSchema";

describe("calendarEventCreateSchema (colorId)", () => {
  it("colorId なしは通る", () => {
    const r = calendarEventCreateSchema.safeParse({
      title: "x",
      start: "2026-06-05T10:00:00Z",
    });
    expect(r.success).toBe(true);
  });

  it("colorId='7' は通る", () => {
    const r = calendarEventCreateSchema.safeParse({
      title: "x",
      start: "2026-06-05T10:00:00Z",
      colorId: "7",
    });
    expect(r.success).toBe(true);
  });

  it("colorId='12' は弾く", () => {
    const r = calendarEventCreateSchema.safeParse({
      title: "x",
      start: "2026-06-05T10:00:00Z",
      colorId: "12",
    });
    expect(r.success).toBe(false);
  });

  it("colorId が数値の 7 は弾く (文字列必須)", () => {
    const r = calendarEventCreateSchema.safeParse({
      title: "x",
      start: "2026-06-05T10:00:00Z",
      colorId: 7,
    });
    expect(r.success).toBe(false);
  });
});

describe("calendarEventPatchSchema (colorId)", () => {
  it("colorId='11' は通る", () => {
    const r = calendarEventPatchSchema.safeParse({ colorId: "11" });
    expect(r.success).toBe(true);
  });

  it("colorId=null は通る (Default 化)", () => {
    const r = calendarEventPatchSchema.safeParse({ colorId: null });
    expect(r.success).toBe(true);
  });

  it("colorId=undefined は通る (変更しない)", () => {
    const r = calendarEventPatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("colorId='0' は弾く", () => {
    const r = calendarEventPatchSchema.safeParse({ colorId: "0" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3.2: テスト実行して失敗を確認**

Run: `npm test -- ticketSchema`
Expected: FAIL — `colorId` プロパティが Zod 側に存在しないため新規テストが落ちる

- [ ] **Step 3.3: schema を拡張**

`lib/validation/ticketSchema.ts` の `calendarEventCreateSchema` / `calendarEventPatchSchema` を以下に置き換え (ファイル末尾)：

```ts
export const googleEventColorIdSchema = z.enum([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
]);

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1).max(255),
  start: z.string().min(1),
  end: z.string().optional(),
  description: z.string().optional(),
  colorId: googleEventColorIdSchema.optional(),
});

export const calendarEventPatchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  description: z.string().optional(),
  colorId: googleEventColorIdSchema.nullable().optional(),
});
```

- [ ] **Step 3.4: テスト + 型チェック**

Run: `npm test -- ticketSchema`
Expected: PASS (全 8 件)

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3.5: コミット**

```bash
git add lib/validation/ticketSchema.ts tests/validation/ticketSchema.test.ts
git commit -m "feat: calendarEvent schema に colorId を追加"
```

---

## Task 4: googleCalendar client を colorId 対応

**Files:**
- Modify: `lib/clients/googleCalendar.ts`
- Create: `tests/clients/googleCalendar.colorId.test.ts`

- [ ] **Step 4.1: 失敗するテストを書く**

`tests/clients/googleCalendar.colorId.test.ts` を作成。`googleapis` を直接モックするより、`toCalendarEvent`/`requestBody` ビルド部の振る舞いを観測する形にする。本タスクでは `lib/clients/googleCalendar.ts` の patchEvent/createEvent に対しスパイを差し込めるよう、`vi.mock("googleapis", ...)` でスタブする。

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPatch = vi.fn();
const mockInsert = vi.fn();
const mockList = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({
      events: {
        patch: mockPatch,
        insert: mockInsert,
        list: mockList,
        get: mockGet,
        delete: mockDelete,
      },
    }),
  },
}));

vi.mock("@/lib/clients/googleAuth", () => ({
  getOAuth2Client: () => ({}),
}));

import {
  listEvents,
  createEvent,
  patchEvent,
} from "@/lib/clients/googleCalendar";

beforeEach(() => {
  mockPatch.mockReset();
  mockInsert.mockReset();
  mockList.mockReset();
});

describe("toCalendarEvent (listEvents 経由)", () => {
  it("colorId を抽出する", async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          {
            id: "e1",
            summary: "test",
            start: { dateTime: "2026-06-05T10:00:00Z" },
            end:   { dateTime: "2026-06-05T11:00:00Z" },
            colorId: "7",
          },
        ],
      },
    });
    const events = await listEvents("2026-06-05T00:00:00Z", "2026-06-06T00:00:00Z");
    expect(events[0].colorId).toBe("7");
  });

  it("colorId なしは undefined", async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          {
            id: "e2",
            summary: "no color",
            start: { dateTime: "2026-06-05T10:00:00Z" },
            end:   { dateTime: "2026-06-05T11:00:00Z" },
          },
        ],
      },
    });
    const events = await listEvents("2026-06-05T00:00:00Z", "2026-06-06T00:00:00Z");
    expect(events[0].colorId).toBeUndefined();
  });
});

describe("createEvent", () => {
  it("colorId を requestBody に含める", async () => {
    mockInsert.mockResolvedValue({
      data: { id: "n1", summary: "x", start: { dateTime: "x" }, end: { dateTime: "y" } },
    });
    await createEvent({
      title: "x",
      start: "2026-06-05T10:00:00Z",
      end:   "2026-06-05T11:00:00Z",
      colorId: "5",
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0].requestBody.colorId).toBe("5");
  });

  it("colorId 未指定なら requestBody.colorId は含まれない", async () => {
    mockInsert.mockResolvedValue({
      data: { id: "n2", summary: "x", start: { dateTime: "x" }, end: { dateTime: "y" } },
    });
    await createEvent({
      title: "x",
      start: "2026-06-05T10:00:00Z",
    });
    expect(mockInsert.mock.calls[0][0].requestBody).not.toHaveProperty("colorId");
  });
});

describe("patchEvent", () => {
  beforeEach(() => {
    mockPatch.mockResolvedValue({
      data: { id: "e", summary: "x", start: { dateTime: "x" }, end: { dateTime: "y" } },
    });
  });

  it("colorId 文字列は requestBody.colorId に入る", async () => {
    await patchEvent("e", { colorId: "11" });
    expect(mockPatch.mock.calls[0][0].requestBody.colorId).toBe("11");
  });

  it("colorId=null は requestBody.colorId=null として送信", async () => {
    await patchEvent("e", { colorId: null });
    expect(mockPatch.mock.calls[0][0].requestBody).toHaveProperty("colorId", null);
  });

  it("colorId 未指定なら requestBody.colorId は含まれない", async () => {
    await patchEvent("e", { title: "rename" });
    expect(mockPatch.mock.calls[0][0].requestBody).not.toHaveProperty("colorId");
  });
});
```

- [ ] **Step 4.2: テスト実行して失敗を確認**

Run: `npm test -- googleCalendar.colorId`
Expected: FAIL — `colorId` を処理する分岐がまだ無い

- [ ] **Step 4.3: client を修正**

`lib/clients/googleCalendar.ts` の以下 3 箇所を修正：

**(1) `toCalendarEvent` 関数**

```ts
function toCalendarEvent(
  api: NonNullable<Awaited<ReturnType<ReturnType<typeof getCalendar>["events"]["get"]>>["data"]>,
): CalendarEvent {
  const start = api.start?.dateTime ?? api.start?.date ?? "";
  const end = api.end?.dateTime ?? api.end?.date ?? "";
  const rawColorId = api.colorId ?? undefined;
  const colorId = isGoogleEventColorId(rawColorId) ? rawColorId : undefined;
  return {
    id: api.id ?? "",
    title: api.summary ?? "(無題)",
    start,
    end,
    description: api.description ?? undefined,
    htmlLink: api.htmlLink ?? undefined,
    colorId,
  };
}

function isGoogleEventColorId(v: string | undefined): v is GoogleEventColorId {
  if (!v) return false;
  return /^([1-9]|1[01])$/.test(v);
}
```

import 文に `GoogleEventColorId` を追加：
```ts
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  GoogleEventColorId,
} from "../types/calendar";
```

**(2) `createEvent` 関数**

`requestBody` 構築を以下に変更：

```ts
const requestBody: Record<string, unknown> = {
  summary: input.title,
  description: input.description,
  start: { dateTime: startDate.toISOString() },
  end: { dateTime: endDate.toISOString() },
};
if (input.colorId !== undefined) {
  requestBody.colorId = input.colorId;
}
const res = await calendar.events.insert({
  calendarId: CALENDAR_ID,
  requestBody,
});
```

**(3) `patchEvent` 関数**

既存の `requestBody` 構築の最後に以下を追加 (description の if の直後)：

```ts
if (input.colorId !== undefined) {
  // null = Default 化 (Google API 側で colorId をクリア)
  requestBody.colorId = input.colorId;
}
```

- [ ] **Step 4.4: テスト + 型チェック**

Run: `npm test -- googleCalendar.colorId`
Expected: PASS (全 7 件)

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4.5: コミット**

```bash
git add lib/clients/googleCalendar.ts tests/clients/googleCalendar.colorId.test.ts
git commit -m "feat: googleCalendar client を colorId 入出力に対応"
```

---

## Task 5: API ルートで colorId を受け取れるようにする

**Files:**
- Modify: `app/api/google/calendar/events/route.ts`

`PATCH` ルートは `calendarEventPatchSchema` を使っており Task 3 で colorId は既に通る。`POST` ルートも `calendarEventCreateSchema` を使っており Task 3 で colorId は schema 上通るが、createEventBody で `colorId` を取り出して `createEvent` に渡す導線が必要。

- [ ] **Step 5.1: route.ts の POST を確認**

`app/api/google/calendar/events/route.ts` を Read で開き、`createEventBodySchema.parse(json)` の結果から `colorId` を `rest` に含めて `createEvent` に渡している (`...rest`) ことを確認する。

実装上 `createEventBodySchema` は `calendarEventCreateSchema.extend({ issueKey: ... })` なので、Task 3 完了後は自動的に `colorId` が `rest` に含まれて `createEvent` に渡される。**追加コード不要**。

- [ ] **Step 5.2: 動作確認用に既存テスト全部実行**

Run: `npm test`
Expected: PASS (既存 + 新規すべて)

- [ ] **Step 5.3: コミットは不要 (差分なし)**

Task 5 はコード変更なし。次に進む。

---

## Task 6: CalendarPane で色を注入する

**Files:**
- Modify: `components/CalendarPane.tsx`

- [ ] **Step 6.1: import を追加**

`components/CalendarPane.tsx` の import セクションに以下を追加：

```ts
import { resolveEventColor } from "@/lib/constants/googleEventColors";
import type { CalendarEvent } from "@/lib/types/calendar";
```

- [ ] **Step 6.2: `fetchEvents` の戻り値型を変更**

```ts
async function fetchEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const res = await fetch(`/api/google/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!res.ok) {
    throw new Error(`カレンダー取得に失敗 (${res.status})`);
  }
  return (await res.json()) as CalendarEvent[];
}
```

- [ ] **Step 6.3: events コールバック内で色を注入**

`<FullCalendar>` の `events` プロパティを以下に変更：

```tsx
events={async (info, success, failure) => {
  try {
    const events = await fetchEvents(info.start.toISOString(), info.end.toISOString());
    const inputs: EventInput[] = events.map((e) => {
      const c = resolveEventColor(e.colorId);
      return {
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: c.background,
        borderColor: c.background,
        textColor: c.foreground,
        extendedProps: {
          description: e.description,
          htmlLink: e.htmlLink,
          colorId: e.colorId,
        },
      };
    });
    success(inputs);
  } catch (e) {
    setError((e as Error).message);
    failure(e as Error);
  }
}}
```

- [ ] **Step 6.4: 型チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6.5: 手動動作確認**

Run: `npm run dev`
ブラウザでカレンダーを開き、Google Calendar 側で色を設定したイベントが対応色で表示されることを確認。色未設定のイベントは Peacock 青で表示される。

- [ ] **Step 6.6: コミット**

```bash
git add components/CalendarPane.tsx
git commit -m "feat: カレンダーに Google Event Colors を表示"
```

---

## Task 7: EventEditModal コンポーネントを作成

**Files:**
- Create: `components/EventEditModal.tsx`

> **注:** 本プロジェクトには `@testing-library/react` 等の React コンポーネントテスト基盤が未導入のため、本タスクは TDD ではなく **手動検証** で品質を担保する。導入は別タスクとしてスコープ外。

- [ ] **Step 7.1: コンポーネント本体を作成**

`components/EventEditModal.tsx` を新規作成：

```tsx
"use client";

import { useState } from "react";
import {
  GOOGLE_EVENT_COLORS,
  resolveEventColor,
} from "@/lib/constants/googleEventColors";
import type {
  CalendarEvent,
  GoogleEventColorId,
} from "@/lib/types/calendar";

interface EventEditModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

export function EventEditModal({ event, onClose, onSaved, onDeleted }: EventEditModalProps) {
  const [title, setTitle] = useState(event.title);
  const [startLocal, setStartLocal] = useState(toLocalInputValue(event.start));
  const [endLocal, setEndLocal] = useState(toLocalInputValue(event.end));
  const [description, setDescription] = useState(event.description ?? "");
  const [colorId, setColorId] = useState<GoogleEventColorId | null>(event.colorId ?? null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title,
        start: fromLocalInputValue(startLocal),
        end: fromLocalInputValue(endLocal),
        description,
      };
      if (colorId !== (event.colorId ?? null)) {
        body.colorId = colorId;
      }
      const res = await fetch(`/api/google/calendar/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `予定更新失敗 (${res.status})`);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/google/calendar/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`予定削除失敗 (${res.status})`);
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const currentSwatch = colorId
    ? resolveEventColor(colorId)
    : resolveEventColor(undefined);

  return (
    <div className="event-edit-modal__backdrop" onClick={onClose}>
      <div
        className="event-edit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="event-edit-modal__header">
          <h2>予定を編集</h2>
          <button
            type="button"
            className="event-edit-modal__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </header>

        {error && <div className="event-edit-modal__error">{error}</div>}

        <label className="event-edit-modal__field">
          <span>タイトル</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="event-edit-modal__row">
          <label className="event-edit-modal__field">
            <span>開始</span>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </label>
          <label className="event-edit-modal__field">
            <span>終了</span>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </label>
        </div>

        <fieldset className="event-edit-modal__color-fieldset">
          <legend>色</legend>
          <div className="event-edit-modal__color-grid">
            <button
              type="button"
              className={`event-edit-modal__color-button${colorId === null ? " is-selected" : ""}`}
              onClick={() => setColorId(null)}
              title="Default (カレンダー既定色)"
              aria-label="Default"
              style={{
                background: "transparent",
                borderColor: currentSwatch.background,
              }}
            >
              <span className="event-edit-modal__color-default-mark">∅</span>
            </button>
            {GOOGLE_EVENT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`event-edit-modal__color-button${colorId === c.id ? " is-selected" : ""}`}
                onClick={() => setColorId(c.id)}
                title={c.name}
                aria-label={c.name}
                style={{ background: c.background }}
              />
            ))}
          </div>
        </fieldset>

        <label className="event-edit-modal__field">
          <span>説明</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </label>

        <footer className="event-edit-modal__footer">
          <div className="event-edit-modal__footer-left">
            {!confirmingDelete ? (
              <button
                type="button"
                className="event-edit-modal__danger"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
              >
                🗑 削除
              </button>
            ) : (
              <div className="event-edit-modal__confirm">
                <span>本当に削除しますか?</span>
                <button
                  type="button"
                  className="event-edit-modal__danger"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  本当に削除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={saving}
                >
                  やめる
                </button>
              </div>
            )}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="event-edit-modal__external"
              >
                ↗ Google で開く
              </a>
            )}
          </div>
          <div className="event-edit-modal__footer-right">
            <button type="button" onClick={onClose} disabled={saving}>
              キャンセル
            </button>
            <button
              type="button"
              className="event-edit-modal__primary"
              onClick={handleSave}
              disabled={saving || !title}
            >
              保存
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.2: 型チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7.3: コミット**

```bash
git add components/EventEditModal.tsx
git commit -m "feat: 予定編集モーダル EventEditModal を追加"
```

---

## Task 8: CalendarPane にモーダルを統合

**Files:**
- Modify: `components/CalendarPane.tsx`

- [ ] **Step 8.1: import 追加**

`components/CalendarPane.tsx` の import に以下を追加：

```ts
import { EventEditModal } from "./EventEditModal";
```

- [ ] **Step 8.2: 編集中イベント state を追加**

`CalendarPane` 関数内の `error` state の直下に追加：

```ts
const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
```

- [ ] **Step 8.3: `handleEventClick` を差し替え**

既存の `handleEventClick` ハンドラの中身を以下に差し替える：

```ts
const handleEventClick = useCallback((arg: EventClickArg) => {
  const ev = arg.event;
  const colorIdRaw = ev.extendedProps.colorId;
  const colorId =
    typeof colorIdRaw === "string" && /^([1-9]|1[01])$/.test(colorIdRaw)
      ? (colorIdRaw as GoogleEventColorId)
      : undefined;
  setEditingEvent({
    id: ev.id,
    title: ev.title,
    start: ev.start?.toISOString() ?? "",
    end: ev.end?.toISOString() ?? "",
    description: (ev.extendedProps.description as string | undefined) ?? undefined,
    htmlLink: (ev.extendedProps.htmlLink as string | undefined) ?? undefined,
    colorId,
  });
}, []);
```

import に `GoogleEventColorId` を追加：
```ts
import type { CalendarEvent, GoogleEventColorId } from "@/lib/types/calendar";
```

- [ ] **Step 8.4: モーダルレンダリング追加**

`return` 内、`<FullCalendar />` の直後に以下を追加：

```tsx
{editingEvent && (
  <EventEditModal
    event={editingEvent}
    onClose={() => setEditingEvent(null)}
    onSaved={() => {
      setEditingEvent(null);
      calendarRef.current?.getApi().refetchEvents();
    }}
    onDeleted={() => {
      setEditingEvent(null);
      calendarRef.current?.getApi().refetchEvents();
    }}
  />
)}
```

- [ ] **Step 8.5: 型チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8.6: 手動動作確認 (CSS なしのまま機能だけ確認)**

Run: `npm run dev`
- 既存の予定をクリックすると `window.confirm` ではなく要素ベースのモーダルが開くこと
- タイトル/時刻/色変更 + 保存で値が反映されること (CSS なしなので見た目は崩れていて OK)
- 削除ボタン 2 段階で削除できること

- [ ] **Step 8.7: コミット**

```bash
git add components/CalendarPane.tsx
git commit -m "feat: カレンダーをクリックで編集モーダルを開く"
```

---

## Task 9: モーダルの CSS スタイル

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 9.1: 既存スタイルとの整合確認**

`app/globals.css` から `--color-surface` / `--color-border` / `--color-accent` / `--font-mono` / `--font-display` 等のトークンが定義されていることを確認する (Read で `:root` 周辺を確認)。

- [ ] **Step 9.2: スタイルを追記**

`app/globals.css` の末尾に以下を追加：

```css
/* =============================================================
   EventEditModal
   ============================================================= */

.event-edit-modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.event-edit-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  color: var(--color-text);
  width: min(560px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--spacing-4);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  font-family: var(--font-mono);
}

.event-edit-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.event-edit-modal__header h2 {
  margin: 0;
  font-family: var(--font-display);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-accent);
  font-size: 14px;
}

.event-edit-modal__close {
  background: transparent;
  border: none;
  color: var(--color-text);
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

.event-edit-modal__error {
  background: rgba(220, 50, 50, 0.15);
  border: 1px solid #d04444;
  color: #ffd0d0;
  padding: var(--spacing-2);
  font-size: 12px;
}

.event-edit-modal__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.event-edit-modal__field > span {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
  font-size: 10px;
}

.event-edit-modal__field input,
.event-edit-modal__field textarea {
  background: var(--color-surface-muted, #1a1a1a);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.event-edit-modal__field textarea {
  resize: vertical;
  min-height: 80px;
}

.event-edit-modal__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-2);
}

.event-edit-modal__color-fieldset {
  border: 1px solid var(--color-border);
  padding: var(--spacing-2);
}

.event-edit-modal__color-fieldset legend {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
  font-size: 10px;
  padding: 0 4px;
}

.event-edit-modal__color-grid {
  display: grid;
  grid-template-columns: repeat(6, 28px);
  gap: 8px;
}

.event-edit-modal__color-button {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.event-edit-modal__color-button.is-selected {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.event-edit-modal__color-default-mark {
  color: var(--color-text);
  font-size: 14px;
  line-height: 1;
}

.event-edit-modal__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.event-edit-modal__footer-left,
.event-edit-modal__footer-right {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  flex-wrap: wrap;
}

.event-edit-modal__footer button {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 6px 10px;
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 11px;
  cursor: pointer;
}

.event-edit-modal__footer button:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.event-edit-modal__footer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.event-edit-modal__primary {
  border-color: var(--color-accent) !important;
  color: var(--color-accent) !important;
}

.event-edit-modal__danger {
  border-color: #d04444 !important;
  color: #ffaaaa !important;
}

.event-edit-modal__confirm {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: 12px;
}

.event-edit-modal__external {
  color: var(--color-accent);
  text-decoration: none;
  font-size: 12px;
}

.event-edit-modal__external:hover {
  text-decoration: underline;
}
```

- [ ] **Step 9.3: 手動動作確認**

Run: `npm run dev`
- モーダルがダークテーマで違和感なく表示されること
- 11 色のボタンが意図通り表示されること (特に Banana=黄の前景色)
- 選択中の色にリングが付くこと
- Default ボタンが識別できること

- [ ] **Step 9.4: コミット**

```bash
git add app/globals.css
git commit -m "feat: EventEditModal のスタイルを追加"
```

---

## Task 10: 受け入れテストと最終確認

**Files:** なし (検証のみ)

- [ ] **Step 10.1: テスト全件パス確認**

Run: `npm test`
Expected: 全件 PASS

- [ ] **Step 10.2: 型チェック / Lint**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run lint`
Expected: PASS

- [ ] **Step 10.3: 手動受け入れ (Google Calendar 公式 Web と並行)**

| シナリオ | 期待動作 |
|---------|---------|
| Google 公式 Web で Banana (5) のイベントを作成 → アプリで表示 | 黄色背景・濃い文字色で表示 |
| Google 公式 Web で色未設定のイベントを作成 → アプリで表示 | Peacock 青で表示 |
| アプリで予定をクリック → モーダル開く | 編集モーダルが正常に開く |
| モーダルで色を Tomato (11) に変更 → 保存 → Google 公式 Web を更新 | 赤に変わって反映される |
| モーダルで色を Default に戻す → 保存 → Google 公式 Web を更新 | colorId がクリアされ既定色に戻る |
| モーダルでタイトルを変更 → 保存 | タイトル更新が Google 側にも反映 |
| モーダルで「🗑 削除」→「本当に削除」 | 予定が消える |
| モーダルで「キャンセル」または背景クリック | 編集破棄 |
| モーダルで「↗ Google で開く」 | 新規タブで Google Calendar の編集画面が開く |
| アプリでチケットを D&D で予定化 | 既定色 (青) で作成される |

- [ ] **Step 10.4: 受け入れ OK ならブランチを push**

```bash
git push -u origin feature/calendar-event-colors
```

- [ ] **Step 10.5: (任意) PR を作成**

`/create-pr main <Backlog URL>` で PR を作成。Backlog URL が未登録の場合はスキップ。

---

## Done

すべての受け入れシナリオが PASS したら作業完了。コミット履歴は以下の順序を想定：

1. `docs:` 設計ドキュメント (本ブランチに既存: `49ea121`)
2. `feat:` Google Calendar Event Colors 定数と型を追加
3. `feat:` calendarEvent schema に colorId を追加
4. `feat:` googleCalendar client を colorId 入出力に対応
5. `feat:` カレンダーに Google Event Colors を表示
6. `feat:` 予定編集モーダル EventEditModal を追加
7. `feat:` カレンダーをクリックで編集モーダルを開く
8. `feat:` EventEditModal のスタイルを追加
