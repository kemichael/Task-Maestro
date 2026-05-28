# Task Maestro

Backlog をマスタとした、個人タスクの一元管理ツール (MVP)。

## 概要

タスクの発生源 (Backlog / Slack / Meet 議事録 / 口頭・思いつき / Google Docs / Markdown) を **一つの画面で** 取り込み、Backlog のチケットとして管理する。「今日やるタスク」「カレンダーへの配置 (D&D)」までを 1 画面で完結する。

詳細は `docs/memo-flow/01_requirements.md` 以降を参照。

## 技術スタック

- TypeScript + Next.js (App Router) — ローカル起動の Web アプリ
- better-sqlite3 — ローカルキャッシュ・設定永続化
- FullCalendar — タイムライン UI + D&D
- googleapis / Backlog REST — 外部 API 連携
- zod / pino — バリデーション・ログ

## セットアップ

```bash
# 1. 依存解決
npm install

# 2. 環境変数の準備
cp .env.example .env.local
# `.env.local` を編集して Backlog / Google の認証情報を埋める

# 3. 開発サーバ起動
npm run dev
# http://localhost:3000 でアプリにアクセス
```

初回起動時に `data/task-maestro.sqlite` が自動生成され、`migrations/0001_init.sql` が適用されます。

## 主要なスクリプト

| コマンド | 用途 |
|----------|------|
| `npm run dev` | 開発サーバ起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番起動 |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint |
| `npm test` | Vitest 実行 |

## 環境変数

`.env.example` を参照。MVP で必須なのは以下:

- `BACKLOG_SPACE_DOMAIN` / `BACKLOG_API_KEY` — Backlog API
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` — Google Calendar

Slack / OpenAI / Claude Code CLI は MVP 後の拡張で使用する。

## 設計成果物

- `docs/memo-flow/01_requirements.md` — 要件定義
- `docs/memo-flow/02_basic_design.md` — 基本設計 (BD-001〜010 + BD-100〜104)
- `docs/memo-flow/03_detailed_design.md` — 詳細設計 (処理ID 単位)

## MVP スコープ

MVP として実装する範囲:

- Backlog チケットの横断表示・編集 (BD-004)
- 「今日やる」リスト (BD-005)
- Google カレンダー連携 + D&D (BD-006)
- 直接チケット作成 (BD-003)
- ダッシュボード統合画面 (BD-104)
- 設定画面 / 認証情報検証 (BD-100 / BD-008)
- SQLite 永続化 / 共通基盤 (BD-103 / BD-102 / 型定義)

未実装 (将来追加):

- Slack メンション取り込み (BD-001)
- Meet 議事録取り込み (BD-002)
- Google Docs / Markdown 読込 (BD-007)
- AI 抽出共通モジュール / プロバイダ切替 (BD-101 / BD-009)
