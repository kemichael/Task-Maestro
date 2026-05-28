# 詳細設計書

本書は基本設計 `02_basic_design.md` の各機能を、Next.js (App Router) を前提に実装可能な処理単位 (BD-XXX-NN) まで分解したものである。
レイヤ表記は次の対応とする:

| 表記 | Next.js での実装位置 |
|------|---------------------|
| Route Handler | `app/api/.../route.ts` |
| Server Action | `app/.../actions.ts` |
| Service | `lib/services/*.ts` |
| Repository | `lib/db/*.ts` (SQLite アクセス) |
| Client | `lib/clients/*.ts` (外部 API ラッパ) |
| View / Component | `app/.../page.tsx` および `components/*.tsx` |

共通方針:
- 型定義は `lib/types/*.ts` に集約。代表的な型 (`SlackMention`, `BacklogIssue`, `MeetingDoc`, `TicketCandidate`, `Settings` 等) はリポジトリ・サービス・クライアント間で再利用
- バリデーションは `zod` を採用 (Route Handler 入力 / AI 出力 / 設定値)
- ログは `pino`、機密値は `redact` でマスク
- エラーは Service 層で `ExternalApiError` / `ValidationError` / `NotFoundError` を投げ、Route Handler で適切な HTTP ステータスに変換

---

## BD-001: Slack メンション取り込み

### BD-001-01: メンション同期 Route Handler

- **レイヤ**: Route Handler (`app/api/slack/mentions/sync/route.ts`)
- **処理詳細**:
  1. POST 受信、リクエストボディは空または `{ since?: string }`
  2. `getEnv()` (BD-008-01) で Slack トークン JSON を取得。欠落時は 412 を返却
  3. `SlackMentionService.sync(since)` を呼出し (BD-001-02)
  4. 戻り値 (新規取得件数 / 失敗ワークスペース一覧) を JSON で返却
- **入力パラメータ**:
  - `since?: string` (ISO8601、省略時は最終同期時刻)
- **戻り値**:
  - `{ inserted: number; updated: number; failedWorkspaces: { workspaceId: string; reason: string }[] }`
- **呼び出し元**: クライアント側ダッシュボード「取り込み」ボタン
- **呼び出し先**: BD-001-02
- **例外処理**:
  - `EnvMissingError` → 412
  - `ExternalApiError` で全 WS 失敗 → 502
  - 部分失敗 → 200 + `failedWorkspaces` で通知
- **ログ出力**:
  - `INFO`: 同期開始 / 終了 (件数)
  - `WARN`: ワークスペース単位の失敗
- **備考**: Next.js の `revalidatePath('/inbox/slack')` を最後に呼ぶ

### BD-001-02: メンション同期 Service

- **レイヤ**: Service (`lib/services/slackMentionService.ts`)
- **処理詳細**:
  1. 設定 (BD-100) から対象ワークスペース一覧と利用者の Slack User ID を取得
  2. `slackMentionRepository.getLatestTimestampByWorkspace()` で各 WS の最終取得 ts を取得
  3. 各 WS について `SlackClient.fetchMentions(token, sinceTs, userId)` (BD-102-01) を呼ぶ
  4. 取得結果を `slackMentionRepository.upsertMany()` に渡す
  5. 例外発生 WS は `failedWorkspaces` に集約し、他 WS は続行
- **入力パラメータ**:
  - `since?: string`
- **戻り値**:
  - `{ inserted, updated, failedWorkspaces }`
- **呼び出し元**: BD-001-01
- **呼び出し先**: BD-102-01 (Slack クライアント)、BD-001-04 (リポジトリ)、BD-100 (設定取得)
- **例外処理**:
  - 個別 WS の例外は捕捉して `failedWorkspaces` に追加
  - 全 WS が失敗した場合のみ呼出し元に例外伝播
- **ログ出力**: 各 WS の取得件数 (DEBUG)、失敗理由 (WARN)
- **備考**: ts は Slack の `ts` フィールドをそのまま保持 (小数文字列)

### BD-001-03: Slack クライアント

詳細は BD-102-01 に集約。

### BD-001-04: メンションリポジトリ

- **レイヤ**: Repository (`lib/db/slackMentionRepository.ts`)
- **処理詳細**:
  1. `upsertMany(rows)` — `INSERT ... ON CONFLICT(workspace_id, ts) DO UPDATE` でメンションを保存
  2. `findUnprocessed(limit)` — `WHERE ticket_id IS NULL ORDER BY ts DESC LIMIT ?`
  3. `markProcessed(id, ticketId)` — `UPDATE SET ticket_id = ?, processed_at = ? WHERE id = ?`
  4. `getLatestTimestampByWorkspace()` — `SELECT workspace_id, MAX(ts) FROM slack_mention GROUP BY workspace_id`
- **入力パラメータ**: 各メソッド固有
- **戻り値**: 配列 / undefined / 件数
- **呼び出し元**: BD-001-02、BD-001-05
- **呼び出し先**: BD-103-02 (DB 接続)
- **例外処理**: SQLite エラーは `DatabaseError` でラップ
- **ログ出力**: クエリ実行件数を DEBUG
- **備考**: prepared statement をモジュールスコープでキャッシュ

### BD-001-05: メンション一覧画面 (`/inbox/slack`)

- **レイヤ**: View (`app/inbox/slack/page.tsx` + Client Component `MentionListClient.tsx`)
- **処理詳細**:
  1. Server Component で `slackMentionRepository.findUnprocessed(100)` を SSR
  2. Client Component で一覧表示 (チェックボックス + 「チケット化」ボタン)
  3. 「チケット化」押下で BD-003 のモーダルを開き、初期値にメンション本文 / パーマリンクをセット
  4. モーダルで作成完了したら `markProcessed(mentionId, ticketId)` を Server Action 経由で呼ぶ
- **入力パラメータ**: なし
- **戻り値**: JSX
- **呼び出し元**: ブラウザ
- **呼び出し先**: BD-001-04、BD-003-01 (作成モーダル)
- **例外処理**:
  - データ取得失敗 → エラーコンポーネント表示
  - 個別マーク失敗 → トースト通知
- **ログ出力**: クライアント側はコンソールへ警告のみ
- **備考**: ページネーション or 無限スクロールは将来対応

---

## BD-002: ミーティング議事録取り込み (Google Meet)

### BD-002-01: 議事録候補取得 Route Handler

- **レイヤ**: Route Handler (`app/api/meetings/candidates/route.ts`)
- **処理詳細**:
  1. GET 受信、クエリパラメータ `since?: string`
  2. `MeetingDocService.fetchCandidates(since)` (BD-002-02) を呼出し
  3. 取得済み候補を JSON で返却
- **入力パラメータ**: `since?: string`
- **戻り値**: `MeetingDoc[]`
- **呼び出し元**: ブラウザの議事録候補画面 (BD-002-05)、起動中の定期 fetch
- **呼び出し先**: BD-002-02
- **例外処理**: `ExternalApiError` → 502。`EnvMissingError` → 412
- **ログ出力**: 取得件数 (INFO)、失敗理由 (WARN)
- **備考**: フロント側は 15 分間隔の `setInterval` でこの API を呼ぶ (タブ表示中のみ)

### BD-002-02: 議事録同期 Service

- **レイヤ**: Service (`lib/services/meetingDocService.ts`)
- **処理詳細**:
  1. 設定 (BD-100) から利用者の Google アカウント (BD-010) を取得
  2. `GoogleCalendarClient.listPastEvents(now - lookback, now)` (BD-102-03) で過去 N 日の利用者参加予定を取得
  3. 各予定に対して BD-002-03 で議事録 documentId を解決
  4. `meetingDocRepository.upsertIfNew(...)` (BD-002-04) で未取込のみ DB に追加
  5. 未抽出 (candidates_json IS NULL) のものについて `MeetingDoc` 本文を Docs API で取得し、BD-101 (AI 抽出) を呼ぶ
  6. 抽出結果を `meetingDocRepository.updateCandidates()` に保存
- **入力パラメータ**: `since?: string`
- **戻り値**: `MeetingDoc[]` (UI 表示用)
- **呼び出し元**: BD-002-01
- **呼び出し先**: BD-102-03 / BD-102-04 / BD-102-05、BD-101-01、BD-010-01、BD-002-03、BD-002-04
- **例外処理**:
  - 個別予定の失敗は警告ログにとどめ、他予定の処理を継続
  - AI 抽出失敗時は `candidates_json` を NULL のまま残し再試行余地を残す
- **ログ出力**: 予定単位の DEBUG、AI 抽出失敗の WARN
- **備考**: `lookback` 既定 7 日。設定で変更可

### BD-002-03: Calendar 予定 → Docs 紐付けロジック

- **レイヤ**: Service (`lib/services/meetingDocLinker.ts`)
- **処理詳細**:
  1. Calendar イベントの `attachments[]` から `mimeType === 'application/vnd.google-apps.document'` のエントリを優先採用
  2. 添付が無い場合、予定タイトル + 開催日でドライブ検索 (`GoogleDriveClient.searchDocs(query)` BD-102-04)
  3. 候補が複数ある場合は所有者 = 利用者本人 のものを優先
  4. 解決できなければ `null` を返却 (議事録なし)
- **入力パラメータ**: Google Calendar Event オブジェクト
- **戻り値**: `documentId | null`
- **呼び出し元**: BD-002-02
- **呼び出し先**: BD-102-04
- **例外処理**: ドライブ検索失敗 → `null` を返し WARN ログ
- **ログ出力**: 候補数 (DEBUG)
- **備考**: 検索 query は `name contains "<予定タイトル>" and modifiedTime > <event.endTime - 1日>` 程度

### BD-002-04: 議事録リポジトリ

- **レイヤ**: Repository (`lib/db/meetingDocRepository.ts`)
- **処理詳細**:
  1. `upsertIfNew(row)` — calendar_event_id をキーに新規のみ挿入
  2. `findRecent(limit)` — `ORDER BY occurred_at DESC LIMIT ?`
  3. `updateCandidates(id, json)` — `candidates_json` を更新
  4. `markProcessed(id)` — `processed_at = now()`
- **入力パラメータ**: 各メソッド固有
- **戻り値**: 配列 / void
- **呼び出し元**: BD-002-02、BD-002-05
- **呼び出し先**: BD-103-02
- **例外処理**: SQLite エラーは `DatabaseError`
- **ログ出力**: DEBUG
- **備考**: `candidates_json` は `TicketCandidate[]` を JSON.stringify したもの

### BD-002-05: 議事録候補画面 (`/inbox/meetings`)

- **レイヤ**: View (`app/inbox/meetings/page.tsx` + `MeetingCandidatesClient.tsx`)
- **処理詳細**:
  1. Server Component で `meetingDocRepository.findRecent(50)` を取得
  2. Client Component で予定ごとに候補リストを展開表示
  3. 候補ごとに「チケット化」ボタン (BD-003-01 のモーダルを開き、初期値にタイトル・本文をセット)
  4. ヘッダに「再スキャン」ボタンで BD-002-01 を再呼出し
- **入力パラメータ**: なし
- **戻り値**: JSX
- **呼び出し元**: ブラウザ
- **呼び出し先**: BD-002-01、BD-002-04、BD-003-01
- **例外処理**: 画面エラー表示
- **ログ出力**: なし (クライアント側コンソールのみ)
- **備考**: 候補の編集 (タイトル・本文・期限の手直し) はモーダル内で行う

---

## BD-003: 直接チケット作成

### BD-003-01: チケット作成モーダル

- **レイヤ**: Component (`components/CreateTicketModal.tsx`)
- **処理詳細**:
  1. props: `initial?: Partial<TicketDraft>`, `onCreated?: (issue) => void`, `open: boolean`, `onClose: () => void`
  2. フォーム要素: タイトル (必須)、プロジェクト (必須 selectbox、`backlog_issue` から派生または設定値)、本文、カテゴリ、優先度、期限、担当者
  3. `zod` でクライアントバリデーション
  4. 「作成」押下で Server Action `createTicket(draft)` (BD-004 系) を呼出し
  5. 成功時 `onCreated` を呼んでモーダルを閉じる
- **入力パラメータ**: 上記 props
- **戻り値**: JSX
- **呼び出し元**: ダッシュボード (BD-104)、Slack 一覧 (BD-001-05)、議事録一覧 (BD-002-05)、チケット一覧 (BD-004-06)
- **呼び出し先**: BD-004-02 (作成)、`zod` スキーマ
- **例外処理**:
  - サーバ側エラー → フォーム内にエラー表示
- **ログ出力**: なし
- **備考**: ショートカット `Ctrl+N` で開ける

### BD-003-02: 作成 DTO とバリデーションスキーマ

- **レイヤ**: 型定義 + バリデーション (`lib/types/ticket.ts`、`lib/validation/ticketSchema.ts`)
- **処理詳細**:
  1. `TicketDraft` 型: `{ projectId, summary, description?, priority?, categoryIds?, dueDate?, assigneeId?, sourceMeta? }`
  2. `sourceMeta` に Slack/議事録/Docs 由来の URL を保存
  3. `zod` スキーマで `summary` 必須、`dueDate` ISO 形式チェック
- **入力パラメータ**: 上記
- **戻り値**: 型 / スキーマ
- **呼び出し元**: BD-003-01、BD-004-02、各 Inbox の選択フロー
- **呼び出し先**: なし
- **例外処理**: `ZodError` → Service 層で `ValidationError` に変換
- **ログ出力**: なし
- **備考**: `sourceMeta` は Backlog 本文末尾に「---\n元: <URL>」として埋め込む

---

## BD-004: Backlog チケット表示・編集

### BD-004-01: チケット同期 Route Handler

- **レイヤ**: Route Handler (`app/api/backlog/issues/sync/route.ts`)
- **処理詳細**:
  1. POST 受信
  2. 設定から対象プロジェクト ID 群と **自分の Backlog ユーザ ID (`settings.backlog.selfUserId`)** を取得
  3. `BacklogIssueService.syncAllProjects()` (BD-004-04) を呼出し
  4. `selfUserId` 未設定時は `{ skipped: "self_user_id_missing" }` を 200 で返却 (エラーではなく明示スキップ)
  5. 件数を返却
- **入力パラメータ**: なし
- **戻り値**: `{ inserted, updated, fetched } | { skipped: "self_user_id_missing" }`
- **呼び出し元**: ダッシュボード「取り込み」、チケット一覧
- **呼び出し先**: BD-004-04
- **例外処理**: 通常通り
- **ログ出力**: 件数 (INFO)、スキップ理由 (WARN)
- **備考**: 並列度は 3 程度に制限し、Backlog のレートを尊重

### BD-004-02: チケット作成 / 編集 Route Handler

- **レイヤ**: Route Handler (`app/api/backlog/issues/route.ts` (POST) + `app/api/backlog/issues/[id]/route.ts` (PATCH/DELETE))
- **処理詳細**:
  1. POST: `TicketDraft` を受信 → `BacklogIssueService.create(draft)` → 作成された issue を返却
  2. PATCH: 部分更新 (ステータス・期限・タイトル・本文・担当者・カテゴリ・優先度)
  3. PATCH 経由でコメント追加する場合は本体のフィールドと分離し `comments[]` を別 API (`/issues/{id}/comments`) に流す
  4. DELETE: 本機能ではサポートしない (501)
- **入力パラメータ**: `TicketDraft` (POST) / `Partial<EditableFields>` + `commentBody?` (PATCH)
- **戻り値**: `BacklogIssue` / 更新後の issue
- **呼び出し元**: BD-003-01、BD-004-06、BD-005-02、BD-006-04 (D&D 経由間接)
- **呼び出し先**: BD-004-04
- **例外処理**:
  - 409 (ステータス遷移不正) → そのまま返却
  - 404 → 削除済みとしてキャッシュも消す
- **ログ出力**: 作成 / 更新の issue_id (INFO)
- **備考**: PATCH は `If-Modified-Since` 相当の楽観ロックは行わず、最終勝ち

### BD-004-03: コメント追加 Route Handler

- **レイヤ**: Route Handler (`app/api/backlog/issues/[id]/comments/route.ts`)
- **処理詳細**:
  1. POST 受信、`{ body: string }`
  2. `BacklogClient.addComment(issueId, body)` (BD-102-02) を呼出し
  3. 作成されたコメントオブジェクトを返却
- **入力パラメータ**: `body: string`
- **戻り値**: `BacklogComment`
- **呼び出し元**: BD-004-06 (詳細パネル)
- **呼び出し先**: BD-102-02
- **例外処理**: 通常通り
- **ログ出力**: コメント ID
- **備考**: コメント本文の改行 (`\n`) は Backlog の Markdown 互換書式で送信

### BD-004-04: チケット Service

- **レイヤ**: Service (`lib/services/backlogIssueService.ts`)
- **処理詳細**:
  1. `syncAllProjects()` — 設定 (BD-100) から `backlog.projects[]` と **`backlog.selfUserId`** を取得
  2. `selfUserId` 未設定なら `{ skipped: "self_user_id_missing" }` を返して終了
  3. 各プロジェクトについて `GET /issues?projectId[]=...&assigneeId[]=<selfUserId>&count=100&offset=...` でページング取得 (担当者フィルタ)
  4. 取得結果を `backlogIssueRepository.upsertMany()` に渡す
  5. ローカルキャッシュにあって Backlog 側に無いものは `deletedFlag` を立てる (or 物理削除)
  6. `create(draft)` — `POST /issues` 呼出し → 結果を `upsertOne()`
  7. `update(id, patch)` — `PATCH /issues/{id}` 呼出し → 結果を `upsertOne()`
- **入力パラメータ**: 各メソッド固有
- **戻り値**: 件数 / `BacklogIssue`
- **呼び出し元**: BD-004-01、BD-004-02、BD-004-05、BD-005、BD-006
- **呼び出し先**: BD-102-02、BD-004-05
- **例外処理**: `ExternalApiError` を投げ直し
- **ログ出力**: 同期件数・更新件数 (INFO)
- **備考**: `BacklogIssue` 型で `priority`, `status`, `assignee` は ID + display name の両方を保持

### BD-004-05: チケットリポジトリ

- **レイヤ**: Repository (`lib/db/backlogIssueRepository.ts`)
- **処理詳細**:
  1. `upsertMany(rows)` / `upsertOne(row)`
  2. `findAll(filter)` — フィルタ (プロジェクト / 担当 / 状態) と order by 対応
  3. `findToday()` — `due_date <= today() OR today_flag = 1`
  4. `setTodayFlag(id, flag)`
  5. `findById(id)`
- **入力パラメータ**: 各メソッド固有
- **戻り値**: 配列 / 単体 / void
- **呼び出し元**: BD-004-04、BD-005-01
- **呼び出し先**: BD-103-02
- **例外処理**: SQLite エラー
- **ログ出力**: DEBUG
- **備考**: `today_flag` は INTEGER (0/1)

### BD-004-06: チケット一覧画面 (`/issues`)

- **レイヤ**: View (`app/issues/page.tsx` + `IssuesListClient.tsx` + `IssueDetailPanel.tsx`)
- **処理詳細**:
  1. Server Component で `backlogIssueRepository.findAll({})` を取得
  2. フィルタペイン (プロジェクト / 状態 / 期限) を表示
  3. 行クリックで詳細パネルを開き、編集フィールドを表示
  4. 「保存」で Server Action 経由 BD-004-02 を呼出し
  5. 「コメント追加」テキストエリア + 送信ボタンで BD-004-03 を呼出し
  6. ヘッダの「取り込み」で BD-004-01 を呼出し、完了後にページ revalidate
- **入力パラメータ**: クエリ (filter)
- **戻り値**: JSX
- **呼び出し元**: ブラウザ
- **呼び出し先**: BD-004-01〜03、BD-004-05
- **例外処理**: トースト通知 + 楽観 UI 戻し
- **ログ出力**: なし
- **備考**: 詳細パネルは画面右側に固定。チケットドラッグハンドルを表示し BD-006 へ D&D 可能

---

## BD-005: 「今日やる」リスト

### BD-005-01: 今日やる選択 Service

- **レイヤ**: Service (`lib/services/todayService.ts`)
- **処理詳細**:
  1. `getTodayList()` — `backlogIssueRepository.findToday()` を呼ぶ
  2. 重複排除 (同一 issue.id を 1 件にまとめる)
  3. 並び順は (a) 期限近い順、(b) 優先度高い順、(c) 更新が新しい順
- **入力パラメータ**: なし
- **戻り値**: `BacklogIssue[]`
- **呼び出し元**: BD-104-02、BD-005-03
- **呼び出し先**: BD-004-05
- **例外処理**: なし
- **ログ出力**: 件数 (DEBUG)
- **備考**: 期限なしチケットは末尾配置

### BD-005-02: 着手チェック Service

- **レイヤ**: Service (`lib/services/todayService.ts` 続き、または `startWorkService.ts`)
- **処理詳細**:
  1. `markStarted(issueId)` — 該当 issue.projectId からステータスマッピング (BD-100) を引く
  2. マッピングされた `status_id` を Backlog API に送る (`PATCH /issues/{id}` の `statusId`)
  3. 戻り値で更新後の issue を BD-004-05 にも反映
- **入力パラメータ**: `issueId: number`
- **戻り値**: 更新後の `BacklogIssue`
- **呼び出し元**: BD-005-03、BD-104-02
- **呼び出し先**: BD-004-04 (update)、BD-100 (settings 参照)
- **例外処理**:
  - マッピング未設定 → `MappingMissingError`、Route 側で 412 + 設定誘導
- **ログ出力**: 状態遷移内容 (INFO)
- **備考**: チェック解除 (取り消し) では Backlog 側を戻さない仕様

### BD-005-03: 今日やるリスト UI

- **レイヤ**: Component (`components/TodayList.tsx`)
- **処理詳細**:
  1. props: `issues: BacklogIssue[]`, `onCheck: (id) => Promise<void>`
  2. 行ごとにチェックボックス + タイトル + プロジェクト + 期限 + ドラッグハンドル
  3. ドラッグハンドルからは外部 D&D データを生成 (`dataTransfer.setData('application/x-tm-issue', JSON.stringify({ id, summary }))`)
- **入力パラメータ**: 上記 props
- **戻り値**: JSX
- **呼び出し元**: BD-104
- **呼び出し先**: BD-005-02 を `onCheck` 経由
- **例外処理**: `onCheck` 失敗時にチェックを戻す
- **ログ出力**: なし
- **備考**: ドラッグ中のゴーストは `summary` のみ短く表示

---

## BD-006: Google カレンダー連携

### BD-006-01: 予定一覧取得 Route Handler

- **レイヤ**: Route Handler (`app/api/google/calendar/events/route.ts` GET)
- **処理詳細**:
  1. クエリ `from`, `to` (ISO8601) を受信
  2. `GoogleCalendarClient.listEvents(from, to)` (BD-102-03) を呼出し
  3. FullCalendar 用に整形 (`{ id, title, start, end, extendedProps: { description, htmlLink } }`)
- **入力パラメータ**: `from: string`, `to: string`
- **戻り値**: `CalendarEvent[]`
- **呼び出し元**: BD-006-04 の FullCalendar `events` コールバック
- **呼び出し先**: BD-102-03
- **例外処理**: `ExternalApiError` → 502
- **ログ出力**: 取得件数 (DEBUG)
- **備考**: タイムゾーンは利用者の OS/Calendar の primary に従う

### BD-006-02: 予定作成 Route Handler

- **レイヤ**: Route Handler (`app/api/google/calendar/events/route.ts` POST)
- **処理詳細**:
  1. POST `{ start, end?, title, description? }` を受信
  2. `end` 未指定時は `start + 60分`
  3. `GoogleCalendarClient.createEvent(...)` で予定作成
  4. 作成された予定を返却
- **入力パラメータ**: `{ start, end?, title, description? }`
- **戻り値**: `CalendarEvent`
- **呼び出し元**: BD-006-05 (D&D ドロップハンドラ)
- **呼び出し先**: BD-102-03
- **例外処理**: 通常通り
- **ログ出力**: 作成 ID
- **備考**: `description` にチケット URL を入れる

### BD-006-03: 予定更新 / 削除 Route Handler

- **レイヤ**: Route Handler (`app/api/google/calendar/events/[id]/route.ts` PATCH / DELETE)
- **処理詳細**:
  1. PATCH: `{ start?, end?, title?, description? }` で `GoogleCalendarClient.patchEvent()`
  2. DELETE: `GoogleCalendarClient.deleteEvent(id)`
- **入力パラメータ**: id (path) + body
- **戻り値**: 更新後の `CalendarEvent` または 204
- **呼び出し元**: BD-006-04 (リサイズ・ドラッグ・削除操作)
- **呼び出し先**: BD-102-03
- **例外処理**: 404 → クライアントで一覧再取得促し
- **ログ出力**: 更新 / 削除 ID
- **備考**: 楽観ロックは取らず最終勝ち

### BD-006-04: カレンダー画面 (FullCalendar)

- **レイヤ**: Component (`components/CalendarPane.tsx`)
- **処理詳細**:
  1. FullCalendar の `dayGrid` / `timeGrid` プラグインを使用、週ビュー既定
  2. `events` コールバックで BD-006-01 を呼ぶ
  3. `eventDrop` / `eventResize` で BD-006-03 を呼ぶ
  4. `eventClick` で詳細ポップオーバー (削除ボタン含む) を出す
  5. `dropAccept` を `application/x-tm-issue` のみに制限し、外部ドロップを受ける
- **入力パラメータ**: なし
- **戻り値**: JSX
- **呼び出し元**: BD-104
- **呼び出し先**: BD-006-01〜03、BD-006-05
- **例外処理**: API エラー時はトースト
- **ログ出力**: なし
- **備考**: 週末表示はデフォルトオン

### BD-006-05: 外部ドロップハンドラ

- **レイヤ**: Component 内ロジック (`CalendarPane.tsx` 内 `handleDrop`)
- **処理詳細**:
  1. `drop` イベントの `dataTransfer.getData('application/x-tm-issue')` を JSON パース
  2. ドロップ時刻を `event.dateStr` から取得、終了時刻はデフォルト 60 分後
  3. BD-006-02 を呼んで予定作成
  4. 成功時カレンダーをリフレッシュ
- **入力パラメータ**: ドロップイベント
- **戻り値**: void
- **呼び出し元**: BD-006-04
- **呼び出し先**: BD-006-02
- **例外処理**: 失敗時はトースト + リフレッシュ
- **ログ出力**: なし
- **備考**: ドロップ元のチケット情報は `summary` と `htmlLink (Backlog URL)` を最低限保持

---

## BD-007: Google ドキュメント / Markdown 読込

### BD-007-01: ドキュメント取込 Route Handler

- **レイヤ**: Route Handler (`app/api/imports/document/route.ts`)
- **処理詳細**:
  1. POST `{ kind: 'gdoc'|'markdown', source: string|FormData }` を受信
  2. kind に応じて Loader (BD-007-02) を呼出し本文を取得
  3. BD-101 (AI 抽出) に渡しチケット候補配列を取得
  4. (任意) `importedDocumentRepository.upsert()` でキャッシュ
  5. 候補配列を返却
- **入力パラメータ**: 上記
- **戻り値**: `TicketCandidate[]`
- **呼び出し元**: BD-007-03
- **呼び出し先**: BD-007-02、BD-101-01
- **例外処理**: `ValidationError` → 400、`ExternalApiError` → 502
- **ログ出力**: 取込元 (INFO)
- **備考**: 同一 source を短時間に重複取込する場合はキャッシュを返す

### BD-007-02: ファイル / URL ローダ

- **レイヤ**: Service (`lib/services/documentLoader.ts`)
- **処理詳細**:
  1. `loadGoogleDoc(url)` — URL から documentId を抽出 → `GoogleDocsClient.getText(documentId)` (BD-102-05)
  2. `loadMarkdown(formData)` — `formData.get('file')` を `text()` で読み込み
  3. 戻り値: `{ title, text }`
- **入力パラメータ**: 上記
- **戻り値**: `{ title, text }`
- **呼び出し元**: BD-007-01
- **呼び出し先**: BD-102-05
- **例外処理**: 不正 URL / 読込失敗 → `ValidationError`
- **ログ出力**: DEBUG
- **備考**: Markdown はサイズ上限を 1MB に制限

### BD-007-03: 取込画面 (`/inbox/docs`)

- **レイヤ**: View (`app/inbox/docs/page.tsx` + Client Component)
- **処理詳細**:
  1. URL 入力欄 + ファイルアップロード input
  2. 「抽出」で BD-007-01 を呼出し、結果を一覧表示
  3. 候補ごとに「チケット化」(BD-003-01 起動)
- **入力パラメータ**: なし
- **戻り値**: JSX
- **呼び出し元**: ブラウザ
- **呼び出し先**: BD-007-01、BD-003-01
- **例外処理**: 画面内エラー表示
- **ログ出力**: なし
- **備考**: 連続抽出時の進捗表示は簡易スピナー

---

## BD-008: 認証情報管理

### BD-008-01: 環境変数検証

- **レイヤ**: Library (`lib/env.ts`)
- **処理詳細**:
  1. `zod` スキーマで以下を検証:
     - `SLACK_TOKENS_JSON` (JSON 配列、各要素 `{ workspaceId, token }`)
     - `BACKLOG_SPACE_DOMAIN` (e.g. `xxx.backlog.com`)
     - `BACKLOG_API_KEY`
     - `GOOGLE_OAUTH_CLIENT_ID`、`GOOGLE_OAUTH_CLIENT_SECRET`、`GOOGLE_REFRESH_TOKEN`
     - `OPENAI_API_KEY` (AI プロバイダが OpenAI の場合)
     - `CLAUDE_CODE_PATH` (任意、PATH に通っていれば不要)
  2. `getEnv()` 関数として export し、サーバ起動時に一度だけ評価 (`globalThis.__env_cached`)
  3. 欠落キーは `EnvMissingError` を投げる代わりに `getEnv()` に `{ missing: string[] }` を載せる
- **入力パラメータ**: なし
- **戻り値**: `Env`
- **呼び出し元**: 全 Route Handler / Service
- **呼び出し先**: `process.env`
- **例外処理**: `ZodError` → 起動ログに記録
- **ログ出力**: 起動時に「設定済みキー一覧」を INFO、値はマスク
- **備考**: クライアントには絶対送らない (`server-only` import を強制)

### BD-008-02: 環境変数サンプル

- **レイヤ**: ファイル (`.env.example`)
- **処理詳細**:
  1. リポジトリ直下に `.env.example` を配置
  2. 各キーの取得方法をコメントで明記 (Slack User Token の取得方法、Google Refresh Token の生成手順など)
- **入力パラメータ**: なし
- **戻り値**: なし
- **呼び出し元**: 利用者 (セットアップ時に手動コピー)
- **呼び出し先**: なし
- **例外処理**: なし
- **ログ出力**: なし
- **備考**: README 内のセットアップ手順から参照

---

## BD-009: AI プロバイダ切替

### BD-009-01: AIProvider インターフェース

- **レイヤ**: Type (`lib/types/aiProvider.ts`)
- **処理詳細**:
  ```ts
  export interface AIProvider {
    name: 'openai' | 'claudeCode';
    extractActionItems(input: {
      text: string;
      userName: string;
      prompt: string;
    }): Promise<string>; // 戻り値は JSON 文字列
  }
  ```
- **入力パラメータ**: 上記
- **戻り値**: なし (型)
- **呼び出し元**: BD-101-01
- **呼び出し先**: BD-009-02 / BD-009-03 が実装
- **例外処理**: 実装側で `AiProviderError`
- **ログ出力**: なし
- **備考**: `extractActionItems` 以外の汎用呼び出しは将来追加

### BD-009-02: OpenAIProvider

- **レイヤ**: Client (`lib/clients/openai.ts` を実装した `lib/providers/openaiProvider.ts`)
- **処理詳細**:
  1. `openai` SDK の `chat.completions.create` を呼ぶ
  2. モデルは設定値 (既定: `gpt-4o-mini`)
  3. `response_format: { type: 'json_object' }` で JSON 強制
  4. `messages`: system (プロンプト)、user (入力テキスト + 利用者名)
  5. レスポンスから `choices[0].message.content` を取り出し返却
- **入力パラメータ**: `extractActionItems` の引数
- **戻り値**: JSON 文字列
- **呼び出し元**: BD-101-01
- **呼び出し先**: BD-102-06 共通エラー型
- **例外処理**: タイムアウト / 401 / 429 → `AiProviderError`
- **ログ出力**: モデル名 + トークン使用量 (DEBUG)
- **備考**: 60 秒タイムアウト

### BD-009-03: ClaudeCodeProvider

- **レイヤ**: Process (`lib/providers/claudeCodeProvider.ts`)
- **処理詳細**:
  1. `child_process.spawn(env.CLAUDE_CODE_PATH ?? 'claude', ['-p'], { stdio: ['pipe', 'pipe', 'pipe'] })` で起動
  2. stdin にプロンプト + 入力テキスト + 「以下の JSON スキーマに従って候補を返せ」指示を流す
  3. stdout を蓄積し EOF (`close`) で取得
  4. `'```json'` ブロックがあれば抜き出して返却、無ければ全体を JSON とみなす
- **入力パラメータ**: `extractActionItems` の引数
- **戻り値**: JSON 文字列
- **呼び出し元**: BD-101-01
- **呼び出し先**: OS の `claude` バイナリ
- **例外処理**:
  - プロセス起動失敗 → `AiProviderError('claude not found')`
  - exit code !== 0 → `AiProviderError(stderr)`
  - JSON パース失敗 → 1 回リトライ
- **ログ出力**: 起動コマンドと exit code (DEBUG)
- **備考**: stdout が極端に大きい場合の OOM 対策として上限を 5MB に制限

---

## BD-010: 利用者識別設定

### BD-010-01: 利用者識別リポジトリ

- **レイヤ**: Repository (`lib/db/userIdentityRepository.ts`)
- **処理詳細**:
  1. `getAll()` — `SELECT * FROM user_identity`
  2. `upsert(service, identifier, displayName)` — `INSERT ON CONFLICT(service, identifier) DO UPDATE`
  3. `findBySlackUserId(userId)` 等のヘルパ
- **入力パラメータ**: 上記
- **戻り値**: 配列 / 単体
- **呼び出し元**: BD-001-02、BD-002-02、BD-006、設定画面
- **呼び出し先**: BD-103-02
- **例外処理**: SQLite エラー
- **ログ出力**: DEBUG
- **備考**: テーブル定義は BD-103 参照

### BD-010-02: 利用者プロフィール設定 UI

- **レイヤ**: View (`app/settings/page.tsx` 内 `IdentitySection`)
- **処理詳細**:
  1. 各サービスごとに ID + 名前のテキストフィールド
  2. 「保存」で Server Action `saveIdentity()` を呼出し
- **入力パラメータ**: なし
- **戻り値**: JSX
- **呼び出し元**: 設定画面
- **呼び出し先**: BD-010-01
- **例外処理**: 入力バリデーション (`zod`)
- **ログ出力**: なし
- **備考**: Slack はワークスペース ID と User ID のペアを複数登録可

---

## BD-100: 設定画面

### BD-100-01: 設定 Server Action

- **レイヤ**: Server Action (`app/settings/actions.ts`)
- **処理詳細**:
  1. `saveSettings(section, payload)` — section ごとに `zod` で検証 → `settingsRepository.upsert()` で JSON 保存
  2. `getSettings(section)` — 取得
  3. `getEnvStatus()` — BD-008-01 の結果を整形 (各キー: 設定済み / 未設定 / 不正)
- **入力パラメータ**: 各メソッド固有
- **戻り値**: void / 設定値 / ステータス
- **呼び出し元**: 設定画面
- **呼び出し先**: BD-100-02、BD-008-01
- **例外処理**: `ValidationError` をフォームに返す
- **ログ出力**: 保存セクション名 (INFO)
- **備考**: `revalidatePath('/settings')` を呼ぶ

### BD-100-02: 設定リポジトリ

- **レイヤ**: Repository (`lib/db/settingsRepository.ts`)
- **処理詳細**:
  1. `get(key)` — `SELECT value_json FROM settings WHERE key = ?`
  2. `upsert(key, value)` — `INSERT ON CONFLICT(key) DO UPDATE`
- **入力パラメータ**: key/value
- **戻り値**: JSON 値 / void
- **呼び出し元**: BD-100-01
- **呼び出し先**: BD-103-02
- **例外処理**: SQLite エラー
- **ログ出力**: DEBUG
- **備考**: 構造化された設定 (例: `backlog.projects`, `slack.workspaces`, `ai.provider`, `status_mapping`) はキー名を `dot.notation` で表現

### BD-100-03: 設定画面 UI

- **レイヤ**: View (`app/settings/page.tsx`)
- **処理詳細**:
  1. タブ: ① 認証 (env 表示)、② AI プロバイダ、③ 利用者識別、④ Backlog、⑤ ステータスマッピング、⑥ Slack ワークスペース
  2. 各セクションは Form コンポーネントで Server Action を呼出し
  3. 認証セクションは `getEnvStatus()` の結果のみ表示 (編集 = `.env.local` 手動修正)
- **入力パラメータ**: なし
- **戻り値**: JSX
- **呼び出し元**: ブラウザ
- **呼び出し先**: BD-100-01
- **例外処理**: フォームエラー
- **ログ出力**: なし
- **備考**: 初回起動時に必須項目未設定なら設定画面に強制遷移

---

## BD-101: AI 抽出共通モジュール

### BD-101-01: 抽出パイプライン

- **レイヤ**: Service (`lib/services/aiExtractionService.ts`)
- **処理詳細**:
  1. `extract(text, userName)` を提供
  2. `ai.provider` 設定から `AIProvider` 実装を選択 (BD-009)
  3. テキストを必要に応じてチャンキング (上限トークン推定で 4000 トークン強)
  4. プロンプトテンプレート (BD-101-02) を読み込み user 入力と組合せ
  5. provider を順に呼出し、戻り JSON を `zod` で `TicketCandidate[]` に検証 (BD-101-03)
  6. 配列を結合して返却
- **入力パラメータ**: `text: string`, `userName: string`, `mode: 'meeting'|'document'`
- **戻り値**: `TicketCandidate[]`
- **呼び出し元**: BD-002-02、BD-007-01
- **呼び出し先**: BD-009-02 / BD-009-03、BD-101-02、BD-101-03
- **例外処理**: `AiProviderError` / `ValidationError`
- **ログ出力**: チャンク数 (DEBUG)、抽出件数 (INFO)
- **備考**: チャンキングは段落単位

### BD-101-02: プロンプトテンプレート

- **レイヤ**: ファイル (`prompts/extract_meeting.md`, `prompts/extract_document.md`)
- **処理詳細**:
  1. mode に応じて使い分け
  2. system パートに JSON 出力スキーマを明示 (`{ candidates: [{ title, body, suggested_due? }] }`)
  3. user パートに利用者名 + テキスト
- **入力パラメータ**: なし
- **戻り値**: 文字列
- **呼び出し元**: BD-101-01
- **呼び出し先**: なし
- **例外処理**: ファイル未存在 → 起動エラー
- **ログ出力**: なし
- **備考**: プロンプト変更時は再起動なしで反映 (ファイル都度読込)

### BD-101-03: JSON 検証スキーマ

- **レイヤ**: Validation (`lib/validation/ticketCandidateSchema.ts`)
- **処理詳細**:
  ```ts
  export const TicketCandidateSchema = z.object({
    candidates: z.array(z.object({
      title: z.string().min(1),
      body: z.string().optional(),
      suggested_due: z.string().date().optional(),
    })),
  });
  ```
- **入力パラメータ**: 文字列 (JSON)
- **戻り値**: `TicketCandidate[]`
- **呼び出し元**: BD-101-01
- **呼び出し先**: なし
- **例外処理**: `ZodError`
- **ログ出力**: 検証失敗時に詳細を WARN
- **備考**: `suggested_due` は ISO 日付

---

## BD-102: 外部 API クライアント

各クライアントは共通の戻り値型・エラー型を持つ。
- `ExternalApiError` ベースに、`reason: 'auth' | 'rateLimit' | 'notFound' | 'network' | 'unknown'`、`retryable: boolean`、`originalStatus?: number` を保持
- リトライは `reason === 'rateLimit' || reason === 'network'` の場合のみ、最大 3 回・指数バックオフ (200ms, 600ms, 2000ms)

### BD-102-01: Slack クライアント

- **レイヤ**: Client (`lib/clients/slack.ts`)
- **処理詳細**:
  1. `fetchMentions({ token, sinceTs, userId })`
  2. `users.conversations` で `types=public_channel,private_channel,im,mpim` の chat 一覧取得
  3. 各 channel について `conversations.history` (`oldest=sinceTs`) を取得し、`text` に `<@userId>` を含むものを抽出
  4. ts・本文・送信者・チャンネル ID・パーマリンク (`chat.getPermalink`) を返却
- **入力パラメータ**: 上記
- **戻り値**: `SlackMention[]`
- **呼び出し元**: BD-001-02
- **呼び出し先**: Slack Web API
- **例外処理**: ratelimited (429) → リトライ、auth エラー → 即時失敗
- **ログ出力**: 取得件数 (DEBUG)
- **備考**: スコープが足りないチャネルは個別に try/catch でスキップ

### BD-102-02: Backlog クライアント

- **レイヤ**: Client (`lib/clients/backlog.ts`)
- **処理詳細**:
  1. ベース URL は `https://${BACKLOG_SPACE_DOMAIN}/api/v2`、認証は `apiKey` クエリパラメータ
  2. `listIssues({ projectIds, count, offset, statusIds?, assigneeIds? })`、`createIssue(payload)`、`patchIssue(id, payload)`、`addComment(id, body)`、`listProjectStatuses(projectId)`、`getMyself()`
  3. `getMyself()` は `GET /users/myself` で本人情報を取得 (BD-010 自動取得用)
  4. レスポンスは型変換層で `BacklogIssue` / `BacklogUser` に整形
- **入力パラメータ**: 各メソッド固有
- **戻り値**: 各レスポンス
- **呼び出し元**: BD-001-02、BD-004 系、BD-005-02
- **呼び出し先**: Backlog REST API
- **例外処理**: 429 → リトライ、401/403 → 即時失敗
- **ログ出力**: 各 API のレスポンスタイム (DEBUG)
- **備考**: ステータス名は `listStatuses` で取得しキャッシュ

### BD-102-03: Google Calendar クライアント

- **レイヤ**: Client (`lib/clients/googleCalendar.ts`)
- **処理詳細**:
  1. `google-auth-library` で OAuth2 を構築。`refresh_token` から `access_token` を都度取得
  2. `events.list({ timeMin, timeMax, singleEvents: true, orderBy: 'startTime' })`
  3. `events.insert`、`events.patch`、`events.delete`
- **入力パラメータ**: 各メソッド固有
- **戻り値**: 整形済み `CalendarEvent`
- **呼び出し元**: BD-002-02、BD-006 系
- **呼び出し先**: Google Calendar API
- **例外処理**: 401 → refresh、404 → notFound
- **ログ出力**: 操作内容 (INFO)
- **備考**: Calendar ID は `'primary'` 固定

### BD-102-04: Google Drive クライアント

- **レイヤ**: Client (`lib/clients/googleDrive.ts`)
- **処理詳細**:
  1. `files.list({ q, fields, orderBy })` — Drive 検索
  2. クエリは `name contains '<タイトル>' and mimeType = 'application/vnd.google-apps.document' and modifiedTime > '<ts>'`
- **入力パラメータ**: クエリ
- **戻り値**: `DriveFile[]`
- **呼び出し元**: BD-002-03
- **呼び出し先**: Google Drive API
- **例外処理**: 通常
- **ログ出力**: ヒット件数 (DEBUG)
- **備考**: スコープ: `drive.readonly`

### BD-102-05: Google Docs クライアント

- **レイヤ**: Client (`lib/clients/googleDocs.ts`)
- **処理詳細**:
  1. `documents.get({ documentId })` で本文取得
  2. `body.content[]` を再帰的に textRun を結合して `text` 文字列を組み立てる
- **入力パラメータ**: `documentId`
- **戻り値**: `{ title, text }`
- **呼び出し元**: BD-002-02、BD-007-02
- **呼び出し先**: Google Docs API
- **例外処理**: 404 → notFound
- **ログ出力**: 取得バイト数 (DEBUG)
- **備考**: 大規模ドキュメントは複数ページに分割される可能性あり (今回は単発取得で十分)

### BD-102-06: 共通エラー / リトライユーティリティ

- **レイヤ**: Library (`lib/clients/_common.ts`)
- **処理詳細**:
  1. `ExternalApiError` クラス
  2. `withRetry(fn, options)` — 指数バックオフリトライ
  3. `mapHttpError(status, body)` — `reason` への振り分け
- **入力パラメータ**: 上記
- **戻り値**: 関数 / クラス
- **呼び出し元**: BD-102-01〜05
- **呼び出し先**: なし
- **例外処理**: `ExternalApiError`
- **ログ出力**: リトライ試行回数 (DEBUG)
- **備考**: タイムアウト既定 30 秒

---

## BD-103: ローカル永続化 (SQLite)

### BD-103-01: DB 接続 + マイグレーション

- **レイヤ**: Library (`lib/db/connection.ts`)
- **処理詳細**:
  1. `better-sqlite3` で `data/task-maestro.sqlite` を開く (`pragma journal_mode = WAL`)
  2. アプリ起動時 (`instrumentation.ts` または最初の require 時) に `migrations/` 配下の `0001_init.sql`, `0002_*.sql`, ... を順に実行
  3. 適用済みは `migration_history (id, filename, applied_at)` に記録
- **入力パラメータ**: なし
- **戻り値**: `Database` インスタンス
- **呼び出し元**: 全 Repository
- **呼び出し先**: ファイルシステム、SQLite
- **例外処理**:
  - DB 破損 → 起動エラーログ
  - マイグレーション失敗 → ロールバック + 起動失敗
- **ログ出力**: マイグレーション適用ファイル名 (INFO)
- **備考**: シングルトン、Hot Reload で多重 open しない工夫

### BD-103-02: 初期スキーマ (`0001_init.sql`)

- **レイヤ**: マイグレーション (`migrations/0001_init.sql`)
- **処理詳細**: 以下のテーブルを作成
  ```sql
  CREATE TABLE migration_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE user_identity (
    service TEXT NOT NULL,
    identifier TEXT NOT NULL,
    display_name TEXT,
    PRIMARY KEY (service, identifier)
  );

  CREATE TABLE slack_mention (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    author_id TEXT NOT NULL,
    body TEXT NOT NULL,
    permalink TEXT NOT NULL,
    ticket_id INTEGER,
    processed_at TEXT,
    fetched_at TEXT NOT NULL,
    UNIQUE (workspace_id, ts)
  );

  CREATE INDEX idx_mention_unprocessed ON slack_mention (processed_at, ts DESC);

  CREATE TABLE meeting_doc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_event_id TEXT NOT NULL UNIQUE,
    document_id TEXT,
    title TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    doc_url TEXT,
    candidates_json TEXT,
    processed_at TEXT
  );

  CREATE TABLE backlog_issue (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    issue_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT,
    status_id INTEGER NOT NULL,
    status_name TEXT NOT NULL,
    priority_id INTEGER,
    assignee_id INTEGER,
    due_date TEXT,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL,
    today_flag INTEGER DEFAULT 0
  );

  CREATE INDEX idx_issue_today ON backlog_issue (today_flag, due_date);
  CREATE INDEX idx_issue_project ON backlog_issue (project_id);

  CREATE TABLE imported_document (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    candidates_json TEXT,
    UNIQUE (source_type, source_ref)
  );
  ```
- **入力パラメータ**: なし
- **戻り値**: なし
- **呼び出し元**: BD-103-01
- **呼び出し先**: SQLite
- **例外処理**: マイグレーション失敗 → ロールバック
- **ログ出力**: 適用結果
- **備考**: 列追加は後続マイグレーション (`0002_*.sql`) で行う

---

## BD-104: ダッシュボード画面

### BD-104-01: ダッシュボードページ (`/`)

- **レイヤ**: View (`app/page.tsx`)
- **処理詳細**:
  1. Server Component で `todayService.getTodayList()` (BD-005-01) を取得
  2. レイアウト: ヘッダ (取り込みボタン群 + チケット作成) + 2 カラム (左 BD-104-02、右 BD-104-03)
  3. 取り込みボタン押下時は順次 BD-001-01、BD-004-01、BD-002-01、BD-007-01 (URL/ファイルなしの再スキャンは BD-002-01 のみ) を呼ぶ
- **入力パラメータ**: なし
- **戻り値**: JSX
- **呼び出し元**: ブラウザ
- **呼び出し先**: BD-104-02、BD-104-03、各 sync API
- **例外処理**: 各 sync の失敗は個別トースト
- **ログ出力**: なし
- **備考**: 同期完了後にページ revalidate

### BD-104-02: 左ペイン (今日やる)

- **レイヤ**: Component (`components/DashboardLeft.tsx`)
- **処理詳細**:
  1. `TodayList` (BD-005-03) を内包
  2. `onCheck` は BD-005-02 経由
  3. ドラッグハンドルからのドラッグデータを発火
- **入力パラメータ**: `issues`
- **戻り値**: JSX
- **呼び出し元**: BD-104-01
- **呼び出し先**: BD-005-02、BD-005-03
- **例外処理**: トースト
- **ログ出力**: なし
- **備考**: スクロール独立 (高さ固定)

### BD-104-03: 右ペイン (カレンダー)

- **レイヤ**: Component (`components/DashboardRight.tsx`)
- **処理詳細**:
  1. `CalendarPane` (BD-006-04) を内包
  2. ドロップを受け付け BD-006-05 を呼出し
- **入力パラメータ**: なし
- **戻り値**: JSX
- **呼び出し元**: BD-104-01
- **呼び出し先**: BD-006 系
- **例外処理**: トースト
- **ログ出力**: なし
- **備考**: 週ビュー既定、画面下部にビュー切替ボタン (日/週/月)

### BD-104-04: D&D ブリッジ層

- **レイヤ**: Component (`components/DashboardDnDProvider.tsx`)
- **処理詳細**:
  1. HTML5 D&D の `dataTransfer.types` に `application/x-tm-issue` を立てる
  2. ドラッグ開始時に `dragImage` をテキストベースで生成 (チケットタイトル)
  3. カレンダー側で `dragenter` / `dragover` で `preventDefault` を呼び、ドロップ可能領域を明示
- **入力パラメータ**: なし
- **戻り値**: JSX (children)
- **呼び出し元**: BD-104-01
- **呼び出し先**: HTML5 D&D
- **例外処理**: なし
- **ログ出力**: なし
- **備考**: FullCalendar の `editable` / `droppable` オプションを併用

---

## 横断補足: 主要な型定義 (`lib/types/`)

```ts
// ticket.ts
export interface TicketDraft {
  projectId: number;
  summary: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high';
  categoryIds?: number[];
  dueDate?: string; // YYYY-MM-DD
  assigneeId?: number;
  sourceMeta?: { kind: 'slack' | 'meeting' | 'document'; ref: string };
}

export interface TicketCandidate {
  title: string;
  body?: string;
  suggested_due?: string;
}

// backlog.ts
export interface BacklogIssue {
  id: number;
  projectId: number;
  issueKey: string;
  summary: string;
  description?: string;
  status: { id: number; name: string };
  priority?: { id: number; name: string };
  assignee?: { id: number; name: string };
  dueDate?: string;
  updatedAt: string;
  todayFlag: boolean;
}

// slack.ts
export interface SlackMention {
  id: number;
  workspaceId: string;
  channelId: string;
  ts: string;
  authorId: string;
  body: string;
  permalink: string;
  ticketId?: number;
  processedAt?: string;
  fetchedAt: string;
}

// meeting.ts
export interface MeetingDoc {
  id: number;
  calendarEventId: string;
  documentId?: string;
  title: string;
  occurredAt: string;
  docUrl?: string;
  candidates: TicketCandidate[]; // candidates_json をパースしたもの
  processedAt?: string;
}

// calendar.ts
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  htmlLink?: string;
}

// settings.ts
export interface StatusMapping {
  projectId: number;
  inProgressStatusId: number;
}

export interface AppSettings {
  ai: { provider: 'openai' | 'claudeCode'; openaiModel?: string };
  backlog: { projectIds: number[] };
  slack: { workspaceIds: string[] };
  statusMapping: StatusMapping[];
}
```

## 横断補足: 起動 / ビルドフロー

1. `npm install` で依存解決 (`next`, `react`, `@fullcalendar/*`, `@anthropic-ai/sdk` (任意)、`openai`, `better-sqlite3`, `google-auth-library`, `@slack/web-api`, `zod`, `pino`, `pino-pretty` 等)
2. `.env.local` を `.env.example` から複製して各キーを設定
3. `npm run dev` で開発起動 (`http://localhost:3000`)、`npm run build && npm run start` で本番起動
4. 初回起動時に `migrations/0001_init.sql` が自動適用される
5. 設定が未完了の場合、ダッシュボードではなく `/settings` に強制リダイレクト

## 横断補足: テスト方針 (Phase 5 で詳細化)

- ユニット: Service / Repository を Vitest でテスト (SQLite はインメモリ DB)
- 統合: Route Handler を Next.js のテストランナー or Playwright で叩く
- 外部 API はモック (msw) で代替
