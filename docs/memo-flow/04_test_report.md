# テスト結果レポート

## 実行コマンド

| 用途 | コマンド |
|------|----------|
| 単体テスト | `npm test` (Vitest) |
| 型チェック | `npm run typecheck` (`tsc --noEmit`) |
| Lint | `npm run lint` (`next lint`) |
| カバレッジ | `npm test -- --coverage` |
| Dev サーバ起動 | `npm run dev` (http://localhost:3000) |

## 結果サマリ

| 項目 | 状態 |
|------|------|
| ユニットテスト実行 | **未実行** (`node_modules` 未インストール環境) |
| 型チェック | **未実行** (同上) |
| Lint | **未実行** (同上) |
| 統合 / E2E | **未実行** (実 API 認証情報なし、`.env.local` 未設定) |
| 手動動作確認 | **未実施** (ユーザー手元の `npm install + npm run dev` を待つ) |

## 用意したテスト

| ファイル | 対象 | テストケース数 |
|----------|------|----------------|
| `tests/validation/ticketSchema.test.ts` | `lib/validation/ticketSchema.ts` | 11 |
| `tests/clients/common.test.ts` | `lib/clients/_common.ts` (`mapHttpError`) | 6 |
| `tests/services/todayService.sort.test.ts` | 今日やるリストのソート規則 (純粋関数として切り出した版) | 3 |
| `tests/errors.test.ts` | `lib/errors.ts` | 4 |

合計 **24 ケース** を用意。実行は `npm test` で完結する。

## 未実行検査の実行手順 (ユーザー側で実施)

```bash
# 依存解決
npm install

# 型チェック (推奨で最初に実施)
npm run typecheck

# Lint
npm run lint

# 単体テスト
npm test

# Dev サーバ起動 → ブラウザで手動確認
npm run dev
```

## 想定される失敗パターン (事前注意)

実装中に推測した懸念点。`npm install` 後の検証で重点的に確認すべき箇所:

| ID | 懸念 | 該当ファイル | 検証方法 |
|----|------|---------------|----------|
| T-001 | `better-sqlite3` のネイティブビルドが Windows で失敗する可能性 | `lib/db/connection.ts` | `npm install` 出力を確認、必要なら `node-gyp` の前提を整備 |
| T-002 | Next.js 15 + React 19 + FullCalendar の型互換性 | `components/CalendarPane.tsx` | `npm run typecheck` で確認 |
| T-003 | `app/api/.../[id]/route.ts` の `params: Promise<...>` 形式は Next.js 15 仕様。古い書式が混ざっていないか | 全 API ルート | `npm run build` で動作確認 |
| T-004 | `googleapis` の OAuth2 型は `google.auth.OAuth2` インスタンス。`googleAuth.ts` の `cachedClient` の型に冗長な箇所あり | `lib/clients/googleAuth.ts` | 型エラーが出る場合、`ReturnType` 部分を `InstanceType<typeof google.auth.OAuth2>` に統一 |
| T-005 | `lib/clients/backlog.ts` で `body` に文字列 (`application/x-www-form-urlencoded`) を渡しているが `fetchJson` は `JSON.stringify` する。Content-Type が JSON 以外のときの分岐が必要 | `lib/clients/_common.ts` の `fetchJson`、および呼び出し元 | 実 Backlog API への接続テスト時に確認 |
| T-006 | `serverComponentsExternalPackages` は Next.js 15 で `serverExternalPackages` にリネーム済 (適用済) | `next.config.ts` | `npm run build` で警告なしを確認 |

特に **T-005 は要修正候補**。Phase 6 (レビュー) で実装エージェントにフォローアップを依頼する。

## 手動動作確認チェックリスト

`npm run dev` 起動後、ブラウザで以下を確認:

- [ ] `/settings` を開く → 環境変数の設定状況が表示される
- [ ] `.env.local` を設定 → 「設定済み」が増える
- [ ] アプリ設定でプロジェクト ID とステータスマッピングを 1 件以上登録 → 保存できる
- [ ] `/issues` を開く → 「Backlog から取り込み」ボタンで実 Backlog のチケットが取得できる
- [ ] チケット行クリック → 詳細パネルでコメント追加できる
- [ ] `/` (ダッシュボード) → 期限が今日以前のチケット or 今日フラグ付きのチケットが「今日やる」リストに並ぶ
- [ ] 今日やる行を D&D → カレンダー上に予定が作成される
- [ ] カレンダーの予定をドラッグ → 時間移動できる、サイズ変更できる、クリック → 削除ダイアログ
- [ ] 「+ チケット作成」モーダル → 直接作成できる

## TDD サイクル履歴

本実行は通常モード (`tdd` フラグなし) のため TDD サイクル履歴はなし。
