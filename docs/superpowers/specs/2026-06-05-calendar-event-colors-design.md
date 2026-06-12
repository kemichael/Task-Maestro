# カレンダーイベント色対応 設計ドキュメント

- 日付: 2026-06-05
- 対象: `components/CalendarPane.tsx` 周辺
- 関連 Backlog: (未登録)
- ステータス: 承認待ち

## 背景・目的

現在、ダッシュボード右ペインのカレンダーはすべてのイベントが青一色で表示されており、種類や重要度の判別が難しい。Google Calendar 側では Event Colors (11 色) を設定できるため、これをアプリ上にも反映し、さらにアプリからも変更可能にすることで以下を実現する。

- Google Calendar 公式アプリと同等の視認性
- 設定箇所を Google Calendar に一元化しつつ、アプリ単体でも色変更を完結
- 既存の D&D・編集・削除フローと自然に統合した編集 UI

## 要件サマリ

| ID | 区分 | 内容 |
|----|------|------|
| FR-001 | 表示 | `events.list` から取得した `colorId` を Google 公式 11 色の RGB にマップしてカレンダー上に表示する。未指定はカレンダー既定色で表示する |
| FR-002 | 編集 | イベントをクリックすると編集モーダルが開き、タイトル・開始/終了時刻・色・説明・削除・Google で開くリンクを操作できる |
| FR-003 | 同期 | アプリ内での色変更は Google Calendar API (`events.patch`) を通じて Google 側にも反映される |
| FR-004 | 既定色 | アプリから新規作成するイベント（チケット D&D／メモ D&D／手動選択）は `colorId` を指定せず、カレンダー既定色で作成される |
| FR-005 | 復元 | 色変更モーダルで「Default」を選択すると `colorId` を明示的にクリア (`null` 送信) してカレンダー既定色に戻す |
| NFR-001 | 視認性 | ダーク背景でも 11 色すべての文字が読める前景色 (`foreground`) を保証する |
| NFR-002 | 整合性 | リッチエディタは導入しない（既存方針）。説明欄は plain `<textarea>` を維持する |

## 設計方針

### カラーパレットの取得方法

Google 公式 11 色を**ハードコード**で持つ（`lib/constants/googleEventColors.ts`）。

理由:
- Google の Event Colors 定義は 2012 年から実質変わっておらず、追従コストは事実上発生しない
- Colors API (`calendar.colors.get()`) を実行時に呼ぶ案も検討したが、認証・キャッシュ・初回描画遅延のコストに見合うメリットがない
- ハードコードにより、テスト容易性・オフライン描画・型安全性 (`GoogleEventColorId` リテラルユニオン) を確保できる

### モーダルの設計

- クリック＝即削除確認 (`window.confirm`) の現挙動を廃止し、編集モーダルに統合する
- 削除はモーダル内で 2 段階確認 (`[🗑 削除]` → `[本当に削除] [やめる]`) する
- `htmlLink` を活用した「Google で開く」リンクをモーダル内に配置し、本格的な設定変更は Google 側に逃がす導線にする

### Default 化のセマンティクス

Google Calendar API では `colorId` を `null` で送ることでカレンダー既定色に戻せる。
- `UpdateCalendarEventInput.colorId` の型を `GoogleEventColorId | null | undefined` とし、
  - `undefined` = フィールド未送信（変更しない）
  - `null` = Default にリセット
  - `"1"`〜`"11"` = 当該色に設定
  を表現する

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (CalendarPane.tsx)                             │
│                                                         │
│  FullCalendar  ← events (backgroundColor / textColor)   │
│       ↓ eventClick                                      │
│  ┌──────────────────┐                                   │
│  │ EventEditModal   │ ← 新規コンポーネント            │
│  │ - title          │                                   │
│  │ - start/end      │                                   │
│  │ - description    │                                   │
│  │ - color picker   │ (12 ボタン: 11 色 + Default)     │
│  │ - [🗑 削除] [↗ Google で開く] [キャンセル] [保存]  │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
              ↓ PATCH / DELETE
┌─────────────────────────────────────────────────────────┐
│ /api/google/calendar/events/[id]                        │
│   patchEvent({ ..., colorId? | null })                  │
└─────────────────────────────────────────────────────────┘
              ↓ google.calendar.events.patch
┌─────────────────────────────────────────────────────────┐
│ Google Calendar API (v3)                                │
└─────────────────────────────────────────────────────────┘
```

## データモデル

### `lib/types/calendar.ts`

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

### `lib/constants/googleEventColors.ts` (新規)

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

// `colorId` 未指定イベントは Google 側のカレンダー既定色で描画されるべきだが、
// 本実装ではユーザの primary カレンダー設定色を取得しないため Peacock 系青で近似する。
// 厳密な追従が必要になった段階で calendarList API 経由の取得に切り替える。
export const DEFAULT_CALENDAR_COLOR = {
  background: "#039be5",
  foreground: "#ffffff",
};

export function resolveEventColor(colorId: GoogleEventColorId | undefined) {
  if (!colorId) return DEFAULT_CALENDAR_COLOR;
  return GOOGLE_EVENT_COLORS.find((c) => c.id === colorId) ?? DEFAULT_CALENDAR_COLOR;
}
```

### Zod スキーマ (`lib/validation/ticketSchema.ts`)

`calendarEventCreateSchema` に `colorId` を追加し、`calendarEventUpdateSchema` を新規追加する。

```ts
const googleEventColorIdSchema = z.enum([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
]);

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
  end: z.string().optional(),
  description: z.string().optional(),
  colorId: googleEventColorIdSchema.optional(),
});

export const calendarEventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  start: z.string().min(1).optional(),
  end: z.string().optional(),
  description: z.string().optional(),
  colorId: googleEventColorIdSchema.nullable().optional(),
});
```

## コンポーネント詳細

### `lib/clients/googleCalendar.ts` 修正

- `toCalendarEvent`: `api.colorId` を `GoogleEventColorId` として CalendarEvent.colorId にコピーする。範囲外の値は無視 (undefined) する
- `patchEvent`: `input.colorId === undefined` ならフィールド未送信、`null` なら `requestBody.colorId = null`、文字列なら `requestBody.colorId = input.colorId`

### API ルート

- `POST /api/google/calendar/events`: `colorId` を schema で受け取り、そのまま `createEvent` に渡す (現状アプリ内導線では未指定だが、将来拡張に備える)
- `PATCH /api/google/calendar/events/[id]`: `calendarEventUpdateSchema` で受信、`null` を含めて `patchEvent` に渡す

### `components/EventEditModal.tsx` (新規)

Props:
```ts
interface EventEditModalProps {
  event: CalendarEvent;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}
```

ローカル state:
- `title`, `start`, `end`, `description`, `colorId` の編集中値
- `confirmingDelete: boolean`
- `error: string | null`
- `saving: boolean`

挙動:
- 色ボタン: 円形 28px、選択中は周囲にリングを描く
- Default ボタンは「斜線入りグレー」アイコンで Google 既定を表現
- `[🗑 削除]` 押下で `confirmingDelete` を true にし、その場で `[本当に削除] [やめる]` を表示
- `[↗ Google で開く]` は `htmlLink` を `target="_blank"` で開く
- 保存後は `onSaved()` 経由で `refetchEvents()`

### `components/CalendarPane.tsx` 修正

- `state`: `editingEvent: CalendarEvent | null` を追加
- `fetchEvents` 内で取得した CalendarEvent を EventInput に変換する際、`resolveEventColor(colorId)` の RGB を `backgroundColor` / `borderColor` / `textColor` に設定
- `handleEventClick`: 現在の `confirm` 削除フローを廃止し、`editingEvent` をセットしてモーダルを開く
- `<EventEditModal>` を `editingEvent` がある時のみレンダリング

### `app/globals.css` 追加

- `.event-edit-modal__backdrop`: 全画面オーバーレイ
- `.event-edit-modal`: コンテナ（既存ダークテーマトークンを使用）
- `.event-edit-modal__color-grid`: 12 色のグリッド
- `.event-edit-modal__color-button`: 円形ボタン、選択時のリング
- ダーク背景に映えるよう、既存 `--color-surface` / `--color-border` トークンに揃える

## エラー処理

| ケース | 動作 |
|--------|------|
| PATCH 失敗 (401/403) | モーダル内にエラー表示、モーダルは閉じない |
| PATCH 失敗 (404) | エラー表示後、モーダル閉じて `refetchEvents()` |
| DELETE 失敗 | モーダル内にエラー表示、再試行可能 |
| 色 picker で想定外 `colorId` | TypeScript 型 + Zod enum で防止 |
| 取得時に範囲外 colorId | `toCalendarEvent` で undefined 扱いにし、Default 色で描画 |

## テスト戦略

### 単体テスト
- `tests/lib/googleCalendar.colorId.test.ts`
  - `toCalendarEvent`: `colorId` ありの API レスポンスから値が抽出される
  - `toCalendarEvent`: `colorId` なし → undefined
  - `patchEvent`: `colorId: undefined` → リクエストに含まれない
  - `patchEvent`: `colorId: null` → `requestBody.colorId === null`
  - `patchEvent`: `colorId: "7"` → `requestBody.colorId === "7"`
- `tests/validation/calendarSchema.colorId.test.ts`
  - `calendarEventUpdateSchema`: `"7"` 通過 / `null` 通過 / `"12"` 拒否 / 数値 `7` 拒否

### 手動検証 (UI)
1. Google Calendar 公式 Web で 11 色それぞれ設定したイベントを作成
2. アプリで対応色で表示されることを確認
3. アプリから色変更 → Google Calendar 公式 Web に反映されることを確認
4. Default 選択 → Google 側で colorId クリアされることを確認
5. ダーク背景でも前景色が読めることを目視確認 (特に Banana=黄)
6. D&D で作成した予定が既定色 (青) で出ることを確認

## 変更ファイル一覧

| 操作 | パス |
|------|------|
| 新規 | `lib/constants/googleEventColors.ts` |
| 修正 | `lib/types/calendar.ts` |
| 修正 | `lib/clients/googleCalendar.ts` |
| 修正 | `lib/validation/ticketSchema.ts` |
| 修正 | `app/api/google/calendar/events/route.ts` |
| 修正 | `app/api/google/calendar/events/[id]/route.ts` |
| 新規 | `components/EventEditModal.tsx` |
| 修正 | `components/CalendarPane.tsx` |
| 修正 | `app/globals.css` |
| 新規 | `tests/lib/googleCalendar.colorId.test.ts` |
| 新規 | `tests/validation/calendarSchema.colorId.test.ts` |

## スコープ外

- カレンダー自体の色 (calendarList の `backgroundColor`) の取得・適用
- 複数カレンダー対応（現状 `primary` 固定）
- 色によるフィルタ/絞り込み機能
- 色プリセットのアプリ独自カスタマイズ
- ライト/ダークテーマ別の色補正

## 設計上の判断

- **A: 11 色ハードコード** を採用（Colors API ランタイム取得は不採用）。理由は前述「設計方針」参照。
- **編集モーダル統合**: 現状の `window.confirm` 即削除を廃止し、編集モーダルに統合。クリック＝即破壊的操作は UX 上問題があり、色変更導線とも整合しないため。
- **新規イベントは既定色固定**: 由来別自動色分け案 (B) も検討したが、「Google 中心で色を管理する」という本来の動機と整合しない＆モーダルで容易に変更可能なため最小実装の A 案を採用。
- **`htmlLink` 露出**: モーダルから「Google で開く」を提供することで、繰り返しイベント・参加者・通知などモーダルでカバーしない設定への退避路を確保する。
