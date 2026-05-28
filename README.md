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

### A. Docker で起動 (推奨 — ローカルに Node.js 不要)

事前準備: Docker Desktop または Docker Engine + Docker Compose v2 がインストール済みであること。

```bash
# 1. 環境変数を準備
cp .env.example .env.local
# `.env.local` を編集して Backlog / Google の認証情報を埋める

# 2-A. 開発モード (Next.js dev サーバ、コード変更でホットリロード)
docker compose --profile dev up --build
# → http://localhost:3000

# 2-B. 本番ビルド動作確認 (multi-stage build、最小ランタイム)
docker compose --profile prod up --build
```

データ (`data/task-maestro.sqlite`) はホストの `./data/` に永続化されます (bind mount)。初回起動時に `migrations/0001_init.sql` が自動適用されます。

#### コンテナ操作の例

```bash
# コンテナ内でテスト実行
docker compose --profile dev exec task-maestro-dev npm test

# 型チェック
docker compose --profile dev exec task-maestro-dev npm run typecheck

# 停止
docker compose down
```

### B. ローカル直接起動 (Node.js 20+ がインストール済みの場合)

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

> **Windows 環境について**: `better-sqlite3` がネイティブビルドを必要とするため、`node-gyp` の前提 (Python 3、Visual Studio Build Tools) が必要です。導入が手間な場合は **A. Docker 起動を推奨** します。

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
