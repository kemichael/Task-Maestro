# レビュー結果レポート

## 対象

- ブランチ: `feature/task-maestro-mvp`
- 差分: `main..HEAD`
- コミット数: 7 件 (うち実装系 6 件 + テスト系 1 件)
- 実装規模: 49 ファイル / 約 3,232 行
- レビュー方式: 観点別に 6 サブエージェントを並列起動

## 観点別評価

| 観点 | 評価 | 主要指摘 |
|------|:----:|----------|
| 要件適合性 | 要修正 | チケット編集 UI 未配線 (FR-004)、カレンダー予定にチケット URL 未埋込 (FR-006)、handleSelect の過剰実装 |
| 設計整合性 | 要修正 | `markStarted` の projectId 解決ルート逸脱、`migration_history` テーブル配置の乖離 |
| コード品質 | 要修正 | `fetchJson` が URL-encoded body も JSON.stringify する致命バグ、`markStarted` の N+1、エラー型未使用 |
| セキュリティ | OK | (Med) Backlog API キー URL クエリ送出 / (Low) pino redact 深さ不足 / (Low) Calendar 一部入力 zod 検証なし |
| テストカバレッジ | 要修正 | `todayService` ソート純粋関数化不足、`fetchJson` / `withRetry` 未検証、統合テスト皆無 |
| ドキュメント | 要修正 | README に API 一覧 / BD→ファイル対応表なし、`.env.example` の OAuth スコープ説明不足 |

総合: **6 観点中 5 観点が「要修正」**、1 観点 (セキュリティ) は OK だが改善余地あり。

## 要修正項目 (優先度順)

### 🔴 優先度高 (実機で必ず壊れる / 要件未充足)

1. **`lib/clients/_common.ts:28-31` — `fetchJson` が URL-encoded ボディを破壊する**
   - 現状: `body !== undefined` なら常に `JSON.stringify(body)` し、`Content-Type: application/json` を最前列に挿入。`backlog.ts` 側で `URLSearchParams` 文字列 + `Content-Type: x-www-form-urlencoded` を渡しても上書きされる結果、Backlog API へのリクエストが `"\"a=1&b=2\""` の JSON 文字列として送られて 400 確実
   - 修正案: `body` が `string` の場合は `JSON.stringify` せずそのまま送る、かつ Content-Type の上書きを呼び出し側に委ねるよう `headers` を後勝ちに調整
   - 影響: BD-004 (チケット作成・更新・コメント追加) 全滅。Calendar 側は googleapis SDK 経由なので影響なし

2. **`components/IssueListClient.tsx` — FR-004 のチケット編集 UI が未配線**
   - 現状: `handleStatusChange` 関数は定義されているが、状態列はテキスト表示のみで実際の編集ハンドルが繋がっていない。期限・タイトル・本文・担当者・カテゴリ・優先度 の編集 UI も未実装 (詳細パネルはコメント追加のみ操作可能)
   - 修正案: `IssueDetailPanel` 相当のエディタを追加し、`PATCH /api/backlog/issues/{id}` に各フィールドを送る UI を実装
   - 影響: 要件 FR-004 (Q4 で確定した「ステータス・期限日・タイトル・本文・担当者・カテゴリ・優先度・コメント追加」) を実機で満たせない

3. **`components/CalendarPane.tsx:35-44` — FR-006「説明欄にチケット URL を埋め込む」未対応**
   - 現状: 説明欄に `Backlog チケット: ${issue.issueKey}` のテキストのみで URL なし
   - 修正案: Backlog のスペースドメインを設定経由で取得し `https://{space}/view/{issueKey}` を埋め込む。スペースドメインは `.env.local` の `BACKLOG_SPACE_DOMAIN` から Server Component → Client へ受け渡すか、Server Action 経由で予定作成する
   - 影響: 予定からチケットに戻れない (BD-006 業務ルール違反)

4. **`lib/services/todayService.ts:33-40` — `markStarted` の projectId 解決ルート逸脱 + N+1**
   - 現状: `listTodayIssues()` を再フェッチして `find(id)` で対象を引いている。今日やる対象外 (期限が未来 + フラグなし) の issue では `find` が失敗する
   - 修正案: `findById(issueId)` で projectId を引く 1 クエリに変更。BD-005-02 の設計通り
   - 影響: 設計逸脱、N+1、特殊条件下で機能しない

### 🟡 優先度中 (要件は満たすが品質低下)

5. **`app/api/backlog/issues/[id]/route.ts:17` 他 — issueId バリデーションで汎用 `Error` を投げて 500 を返している**
   - 修正案: `ValidationError` を投げて 400 にマップ。`errorResponse` ヘルパーは ValidationError を 400 に変換済
   - 同様の箇所: `app/api/backlog/issues/[id]/comments/route.ts`, `app/api/today/[id]/start/route.ts`, `app/api/today/[id]/flag/route.ts`

6. **`tests/services/todayService.sort.test.ts` — 実コードではなくテスト内再実装の検証**
   - 修正案: `lib/services/todayService.ts` の `priorityRank` / ソート関数を `lib/services/todaySorter.ts` へ切り出し、テストはそれを import。実装ドリフトを検出可能にする

7. **`lib/clients/backlog.ts:36-48` — Backlog API キーを URL クエリで送出 (Med セキュリティ指摘)**
   - 修正案: `Authorization` ヘッダ方式は Backlog API では未サポート。`apiKey` クエリは公式の方式だが、URL がログ・履歴に残る点を踏まえ、ログ出力時に URL からマスクするユーティリティを `_common.ts` に追加することで緩和

8. **`migrations/0001_init.sql` — `migration_history` テーブルが DDL に含まれていない**
   - 現状: `connection.ts` 内で `CREATE TABLE IF NOT EXISTS migration_history ...` を直接実行している
   - 修正案: 設計 (BD-103-02) 通り `migration_history` を `0001_init.sql` の最上段に移し、`connection.ts` 側の DDL は削除。あるいは設計を実装に合わせて更新

### 🟢 優先度低 (体裁・改善余地)

9. **`lib/logger.ts` の pino `redact` が浅いパスのみ — `cause.*.refresh_token` や深いネストはマスクされない**
   - 修正案: `redact.paths` に `*.cause.*.refresh_token`、`*.cause.*.access_token` を追加。あるいは `errorResponse` 内で `cause` を意図的に剥がしてからログ出力

10. **`app/api/google/calendar/events/route.ts` / `[id]/route.ts` — 一部入力に zod 検証なし**
    - 修正案: `eventId` (path) や `from`/`to` (query) を zod で検証する小さなスキーマを追加

11. **`README.md` — 主要 API エンドポイント一覧と BD→ファイル対応表が無い**
    - 修正案: `## API` セクションを追加 (`POST /api/backlog/issues/sync` 等)、`## 実装と設計の対応` に BD-XXX とパスの対応を箇条書きで列挙

12. **`.env.example` — Google OAuth スコープの正式名、Slack JSON 検証手順が不足**
    - 修正案: コメントに `# scope: https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly` を追記。SLACK_TOKENS_JSON のサンプル JSON を例示し、検証コマンド (`node -e 'JSON.parse(process.env.SLACK_TOKENS_JSON)'` 相当) を案内

13. **`tests/clients/common.test.ts` — `fetchJson` 本体の正常系・タイムアウト・JSON パース失敗が未検証**
    - 修正案: msw か `vi.fn().mockImplementation((url, init) => ...)` で `global.fetch` をスタブし、成功/429/abort/JSON 不正 各ケースを検証

14. **統合テスト皆無** — Route Handler レベルのテストがない
    - 修正案: 本格的には Playwright か Next.js のサーバアクションテストで `/api/...` を叩くテストを 1〜2 本書く。MVP 範囲では優先度低

## 要確認項目 (ユーザー判断)

1. **`components/CalendarPane.tsx` の `handleSelect`** — カレンダー枠を範囲選択して任意の予定タイトルを prompt 入力できる導線がある。FR-006 は「Backlog チケットを D&D して予定化」が主旨で、純粋な予定作成は要件外。残すか削除するか判断が必要
2. **チケット編集 UI の完成度** — MVP として「コメント追加だけ」でも回せるか、それとも FR-004 完全実装まで必須か
3. **`migration_history` 配置の正規化** — 設計を実装に合わせて更新するか、実装を設計に合わせて修正するか

## 自動修正ループ (`allAllow` 時のみ最大 2 周)

本実行は `allAllow` 非指定のため、自動修正ループは実施せず、ユーザー判断を仰ぐ位置で停止する。

## 総合判定

- [x] **優先度高 4 件 を修正済み** (下記「修正履歴」参照)
- [ ] PR 作成可 (中・低の指摘は後続コミット / 別 PR で対応)
- [ ] 要再レビュー (任意)

## 修正履歴 (2026-05-28 追加)

| # | 指摘 | 対応コミット | 内容 |
|---|------|-------------|------|
| 1 | `fetchJson` の URL-encoded body 破壊 | `fix:fetchJson が文字列/URLSearchParams body を破壊しないよう修正` | `body` が `string` / `URLSearchParams` の場合は `JSON.stringify` せず、Content-Type の自動付与もスキップ。`fetchJson` の単体テスト 5 ケース、`withRetry` の単体テスト 3 ケースを追加 |
| 2 | `markStarted` の projectId 解決ルート逸脱 + N+1 | `fix:markStartedをfindById経由でprojectId解決するよう修正` | `listTodayIssues().find(id)` を `findById(issueId)` に置換し、見つからないときは `NotFoundError` を投げる (HTTP 404 にマップ) |
| 3 | カレンダー予定にチケット URL 未埋込 (FR-006 違反) | `fix:カレンダー予定の説明欄にBacklogチケットURLを埋め込み` | `POST /api/google/calendar/events` で `issueKey` を受け取り、`BACKLOG_SPACE_DOMAIN` から `https://{domain}/view/{issueKey}` を生成して description に追記。`CalendarPane.handleDrop` を更新 |
| 4 | チケット編集 UI 未配線 (FR-004 違反) | `feat:チケット詳細パネルにタイトル/本文/期限/優先度/担当者/カテゴリ編集UIを追加` | `IssueListClient` 詳細パネルにタイトル・本文・期限・優先度・担当者 ID・カテゴリ ID・コメントの編集フォームを追加、`PATCH /api/backlog/issues/{id}` に差分のみ送信。状態遷移はダッシュボードの「今日やる」着手ボタンに集約する旨をヒントとして表示 |

## 残り後対応 (優先度中・低)

中:
- `app/api/backlog/issues/[id]/route.ts` 他で issueId バリデーション失敗時に `ValidationError` を投げて 400 にする
- `tests/services/todayService.sort.test.ts` のソート関数を `lib/services/todaySorter.ts` に純粋関数として切り出し、テストはそれを import
- Backlog API キー URL クエリの漏出緩和 (ログ出力時 URL マスク)
- `migration_history` テーブル定義を `0001_init.sql` に取り込み (`connection.ts` 側 DDL は削除)

低:
- pino redact のパス拡充 (`*.cause.*.refresh_token` 等)
- README に主要 API 一覧と BD→ファイル対応表
- `.env.example` に Google OAuth スコープと SLACK_TOKENS_JSON 検証手順
- 統合テスト (Playwright や Route Handler 単体) 1〜2 本

## 観点別評価 (詳細出力)

サブエージェントが返した本文は付録 A〜F として末尾に格納。
