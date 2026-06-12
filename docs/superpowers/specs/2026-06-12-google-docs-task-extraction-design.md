# Google ドキュメントからのタスク抽出 設計ドキュメント (FR-007 + FR-002)

- 作成日: 2026-06-12
- 対象要件: FR-007 (Google ドキュメント / Markdown 読み込み)、FR-002 (ミーティング議事録取り込み)
- 参照: `docs/memo-flow/01_requirements.md`

## 1. 目的とスコープ

任意の Google ドキュメント、および Google Meet の議事録 (Google Docs に保存) を取り込み、
AI 抽出により Backlog チケット候補 (`TicketCandidate[]`) を生成して、利用者が編集・選択のうえ
既存のチケット作成導線でチケット化できるようにする。

抽出エンジンを中核に据え、以下の 2 つの入力経路が同じエンジンを共用する。

- **FR-007 (手動)**: 利用者が Google Docs の URL を入力して取り込む
- **FR-002 (自動)**: Google Calendar の終了済み予定に紐づく議事録 Docs を自動検出して取り込む

### スコープ内

- AI プロバイダ抽象化 (OpenAI API / Claude Code CLI を設定で切替)
- Google Docs API による本文取得 (Docs/Drive スコープ追加が前提)
- FR-007 手動ドキュメント抽出 UI とチケット化
- FR-002 議事録自動紐付け・検出・抽出・処理済み管理

### スコープ外

- Markdown ファイルアップロード経路 (要件 FR-007 に含まれるが、本サイクルでは Google Docs URL に限定)
- Google Meet 以外の会議ツール議事録 (要件のスコープ外)
- 常時稼働での自動検知 (アプリ起動中の手動トリガのみ)

## 2. 全体アーキテクチャ

```
[入力源]                  [抽出エンジン (共用)]            [出力]
 Google Docs URL ─┐
                  ├─→ docText ─→ AIProvider ─→ TicketCandidate[] ─→ 既存 createTicket
 Meet 議事録(自動)─┘            (openai / claudeCode)              → POST /api/backlog/issues
```

3 層構成:

1. **入力取り込み層** — Google Docs/Drive/Calendar からテキストとメタ情報を取得
2. **抽出エンジン層 (共用)** — テキスト + ソースメタ → AIProvider → 検証済み `TicketCandidate[]`
3. **出力層** — 既存の `createTicket` / `POST /api/backlog/issues` でチケット化

## 3. コンポーネント設計

### 3.A AI 抽出エンジン (共用・新規)

| ファイル | 役割 |
|---|---|
| `lib/types/ai.ts` | `ExtractionInput { text, sourceMeta, selfName? }`、`AIProvider` インターフェース定義 |
| `lib/services/ai/openaiProvider.ts` | OpenAI Chat Completions を `fetch` で直接呼び出し、JSON mode (`response_format`) で候補生成 |
| `lib/services/ai/claudeCodeProvider.ts` | `CLAUDE_CODE_PATH` の `claude` CLI を `child_process` で起動。stdin にプロンプト、stdout から JSON を受領 |
| `lib/services/ai/index.ts` | `getProvider(provider: AIProviderKind)` でプロバイダを解決 |
| `lib/services/aiExtractionService.ts` | 本文 + `sourceMeta` を受け取りプロバイダを実行し、zod で出力検証して `TicketCandidate[]` を返す |
| `lib/validation/extractionSchema.ts` | AI 出力 (候補配列) の zod スキーマ |

設計判断:

- **OpenAI は公式 SDK ではなく `fetch` で直接呼び出す**。依存追加を避け、JSON mode は REST の `response_format: { type: "json_object" }` で十分。モデル名は `AISettings.openaiModel` (既定 `gpt-4o-mini`) を使用。
- **AIProvider インターフェース**:
  ```ts
  interface ExtractionInput {
    text: string;
    sourceMeta: TicketSourceMeta; // kind: "document" | "meeting", ref: URL
    selfName?: string;            // FR-002 の発話者・割当先識別用 (任意)
  }
  interface AIProvider {
    extractCandidates(input: ExtractionInput): Promise<TicketCandidate[]>;
  }
  ```
- プロンプト整形は純粋関数 (`buildExtractionPrompt(input)`) に切り出してテスト可能にする。
- AI 出力は必ず `extractionSchema` で検証し、`TicketCandidate[]` に正規化する。

### 3.B Google Docs / Drive 取り込み (新規 + 変更)

| ファイル | 役割 |
|---|---|
| `lib/clients/googleDocs.ts` | `getDocumentText(documentId): Promise<string>` — Docs API v1 で本文取得しプレーンテキスト化 |
| `lib/utils/googleDocsUrl.ts` | URL から `documentId` を抽出する純粋関数 (`/document/d/<id>/`) |
| `lib/clients/googleCalendar.ts` (変更) | `listEvents` の結果に attachments / attendees を載せる (FR-002 用) |
| `lib/types/calendar.ts` (変更) | `CalendarEvent` に `attachments?`, `attended?` を追加 |

設計判断:

- Docs 本文の抽出は `documents.get` のレスポンス `body.content[].paragraph.elements[].textRun.content` を連結してプレーンテキスト化する。
- `googleCalendar.ts` の変更 (`toCalendarEvent` / `listEvents`) は既存シンボルの編集にあたるため、実装前に `gitnexus_impact` を実行し影響範囲を確認する。`attachments` / `attended` は追加プロパティ (任意) とし、既存の表示・作成・編集には影響させない。

> **前提条件 (ブロッカー)**: 現状の `GOOGLE_REFRESH_TOKEN` は Calendar スコープのみの可能性が高い。
> Docs を読むには `https://www.googleapis.com/auth/documents.readonly` および
> `https://www.googleapis.com/auth/drive.readonly` スコープを付与した refresh token を再発行する必要がある。
> この手順をマニュアル (`app/manual/manual.md`) に追記する。

### 3.C FR-007 手動ドキュメント (新規)

| ファイル | 役割 |
|---|---|
| `app/api/documents/fetch/route.ts` | `POST { docUrl }` → Docs 本文テキストを返却 (抽出前に画面で内容確認させる) |
| `app/api/documents/extract/route.ts` | `POST { text, sourceRef }` → `TicketCandidate[]` を返却 |
| `app/documents/page.tsx` | FR-007 ページ (SSR シェル) |
| `components/DocumentExtractPane.tsx` | URL 入力 → 本文プレビュー → 「AI 抽出」 → 候補一覧 (編集可・チェック選択・プロジェクト選択) → 「選択をチケット化」 |

設計判断:

- **取得 (`fetch`) と抽出 (`extract`) を 2 エンドポイントに分離**する。これにより非機能要件「外部 API へ送信する内容を利用者が事前に確認できる」を満たす (本文を画面に表示してから AI 抽出ボタンで明示送信)。
- 候補のチケット化は既存の `POST /api/backlog/issues` を候補ごとに呼ぶ。`sourceMeta.kind = "document"`, `ref = docUrl` を付与し、本文に元 URL を含める。

### 3.D FR-002 議事録自動紐付け (新規 + 変更)

| ファイル | 役割 |
|---|---|
| `migrations/0006_add_meeting_doc.sql` | `MeetingDoc` 永続化テーブル (処理済み管理用) |
| `lib/db/meetingDocRepository.ts` | MeetingDoc の upsert / 一覧 / 処理済みマーク |
| `lib/services/meetingService.ts` | 終了済み予定 (自分参加) ↔ 議事録 Docs を自動紐付けし候補化 |
| `app/api/meetings/route.ts` | 検出された議事録一覧の取得 (走査 + upsert) |
| `app/api/meetings/[id]/extract/route.ts` | 指定議事録の抽出 → `TicketCandidate[]` |
| `app/api/meetings/[id]/route.ts` | 処理済みマーク (`processedAt` 更新) |
| `app/meetings/page.tsx` + コンポーネント | 検出議事録一覧 → 抽出 → 候補 → チケット化 → 処理済み |
| `app/layout.tsx` (変更) | ナビに「ドキュメント」「議事録」リンクを追加 |

自動紐付けヒューリスティック (要件 3.2 準拠):

1. まず予定の **attachments** (Meet メモ = Drive ファイル) から `documentId` を取得
2. 無ければ予定**タイトル + 実施日**で Drive 内 Docs を検索してマッチ
3. 自分が**参加者**だった**終了済み**予定のみ対象とする

設計判断:

- 紐付けロジックは純粋関数に切り出し (`linkMeetingDoc(event, driveCandidates)`)、テスト可能にする。
- `MeetingDoc` は要件「処理済みは再表示時に除外可能」を満たすため DB 永続化する。`calendarEventId` を一意キーとして upsert。
- `app/layout.tsx` のナビ変更は既存シンボルの編集にあたるため、実装前に `gitnexus_impact` を実行する。

## 4. データフロー

### FR-007

1. 利用者が Docs URL を入力
2. `POST /api/documents/fetch` → `googleDocsUrl` で documentId 抽出 → `googleDocs.getDocumentText` で本文取得 → 本文返却
3. 画面に本文プレビュー表示 → 利用者が「AI 抽出」押下
4. `POST /api/documents/extract` → `aiExtractionService` → `TicketCandidate[]`
5. 候補を編集・選択 → 各候補を `POST /api/backlog/issues` (`createTicket`) でチケット化

### FR-002

1. アプリ起動中、議事録ページ表示時に `GET /api/meetings`
2. `meetingService` が Calendar 終了済み予定 (自分参加) を走査 → 議事録 Docs を自動紐付け → `MeetingDoc` を upsert
3. 利用者が議事録を選び `POST /api/meetings/[id]/extract` → 本文取得 → `aiExtractionService` → 候補
4. 候補を編集・選択 → `POST /api/backlog/issues` でチケット化
5. `POST /api/meetings/[id]` で `processedAt` をマーク (再表示時に除外可能)

## 5. データモデル

`migrations/0006_add_meeting_doc.sql` (既存マイグレーションの規約に合わせる):

```sql
CREATE TABLE meeting_doc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_event_id TEXT NOT NULL UNIQUE,
  document_id TEXT,
  title TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  doc_url TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`candidates` は抽出のたびに生成する一時データのため永続化しない (要件上は再抽出可能とする)。

## 6. エラーハンドリング / 非機能

- 既存の `ExternalApiError` / `lib/http/response.ts` の `errorResponse` / `ok` 規約を踏襲する。
- Docs/Drive API の 401/403 (スコープ不足含む) は認証エラーとして扱い、設定・マニュアルへ誘導する。
- AI 出力が不正 JSON の場合は zod で弾き、利用者にエラーを表示してリトライ可能にする。
- プロバイダ呼び出し失敗時は要件 3.9 通り「もう一方のプロバイダへの手動切替」を促すメッセージを返す。
- 外部 API へ送信する本文を事前に画面で確認できる導線 (FR-007 のプレビュー / FR-002 の議事録本文表示) を担保する (非機能セキュリティ要件)。
- 認証情報はログに出力しない (既存方針踏襲)。

## 7. テスト方針 (既存 vitest 踏襲)

- `googleDocsUrl`: URL から documentId を抽出する純粋関数の正常系・境界 (各種 URL 形式・不正値)
- `extractionSchema`: AI 出力の検証 (正常 / 不正 JSON / 欠損フィールド)
- `buildExtractionPrompt`: プロンプト整形純粋関数の出力検証
- `openaiProvider` / `claudeCodeProvider`: API / CLI をモックし「テキスト → 候補」を検証
- `meetingService` の `linkMeetingDoc`: 自動紐付け (attachments 優先 → タイトル/日付フォールバック) を純粋関数として検証

## 8. 実装順序 (想定)

1. AI 抽出エンジン (3.A) — 単体で完結しテスト可能
2. Google Docs 取り込み (3.B) + FR-007 (3.C) — 手動経路でエンドツーエンドの価値
3. FR-002 (3.D) — 1・2 のエンジンを再利用して自動検知を追加

## 9. 未確定・実装時に確認する事項

- `GOOGLE_REFRESH_TOKEN` のスコープ再発行手順 (マニュアル追記)
- `googleCalendar.ts` / `app/layout.tsx` 変更時の `gitnexus_impact` 結果
- OpenAI / Claude Code それぞれのプロンプトとモデルパラメータの最終調整
