<div align="center">
  <img src="./public/logo.png" alt="Task Maestro" width="280" />

  <p>
    <strong>Backlog をマスタにした、個人タスク統合管理 Web アプリ</strong>
  </p>

  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15.1-black?logo=next.js" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
    <img alt="SQLite" src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white" />
    <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" />
  </p>
</div>

---

## ✨ 概要

**Task Maestro** は、Backlog の自分が担当するチケットを軸に、日々のタスクを 1 画面で扱うための個人用 Web アプリです。

- 🎯 **Backlog のチケットを「自分担当のみ」で横断取得**して一覧 / 編集
- 🌅 **「今日やる」リスト** で本日着手すべきタスクを集約 (期限 ≤ 本日 ＋ 手動フラグ、完了は自動除外)
- 📅 **Google カレンダーを横並び表示** + チケットをドラッグ&ドロップで予定化
- ✏️ **Markdown 対応** のリッチテキストで本文・コメント編集
- 🔗 **親子課題の関係** を視覚的にレイアウト
- ⭐ **行内 ★ クリック** で「今日やる」を即トグル
- 🔍 **キーワード / プロジェクト / ステータス (完了以外) / 優先度 / 期限 / 親子順** で絞り込み&並び替え

完全ローカル動作、認証情報は `.env.local` に集約。追加サブスクリプション不要 (Backlog / Google API は既存契約のみ)。

---

## 🖼️ 画面構成

| 画面 | URL | 概要 |
|------|-----|------|
| ダッシュボード | `/` | 今日やるリスト + Google カレンダー (D&D 連携) |
| チケット一覧 | `/issues` | Backlog チケットの横断検索・編集 (親子レイアウト、フィルタ、ソート) |
| マニュアル | `/manual` | アプリ内マニュアル (操作チートシート、トラブルシューティング) |
| 設定 | `/settings` | 環境変数の状態 + 利用者プロフィール / プロジェクト / ステータスマッピング |

---

## 🛠️ 技術スタック

| 領域 | 採用 |
|------|------|
| フレームワーク | **Next.js 15 (App Router) + React 19** |
| 言語 | TypeScript 5.7 |
| 永続化 | **SQLite** (`better-sqlite3`) + ファイルベース・マイグレーション |
| UI | カスタム CSS (デザイントークン化)、**FullCalendar** (カレンダー + D&D)、**@uiw/react-md-editor** (Markdown エディタ) |
| バリデーション | **zod** |
| ロガー | **pino** (機密値は redact 済) |
| 外部 API | Backlog REST / Google Calendar / Google Drive / Google Docs |
| テスト | **Vitest** (24 ケース) |
| 配布 | **Docker** (Multi-stage production build + dev profile) |

---

## 🚀 セットアップ

### A. Docker (推奨)

事前準備: Docker Desktop または Docker Engine + Docker Compose v2。

```bash
# 1. クローン
git clone https://github.com/kemichael/Task-Maestro.git
cd Task-Maestro

# 2. 環境変数を準備
cp .env.example .env.local
# `.env.local` を編集して Backlog / Google の認証情報を埋める (下記参照)

# 3-A. 開発モード (Next.js dev、ホットリロード)
docker compose --profile dev up -d --build
# → http://localhost:3000

# 3-B. 本番ビルド動作確認 (multi-stage, standalone output)
docker compose --profile prod up -d --build
```

> ⚠️ **`.env.local` を変更したら `restart` ではなく必ず `force-recreate`** してください。
> `docker compose --profile dev up -d --force-recreate`
> (Docker Compose の env_file は restart では再読み込みされません。)

### B. ローカル直接 (Node.js 20+)

```bash
npm install
cp .env.example .env.local  # 編集
npm run dev
```

> Windows で `better-sqlite3` のネイティブビルドに躓いたら、A の Docker 起動が確実です。

---

## 🔑 必要な認証情報

`.env.local` に以下を設定します。詳細は `/manual` ページ末尾の「付録: 認証情報の取得方法」を参照。

| キー | 用途 | 必須 |
|------|------|:----:|
| `BACKLOG_SPACE_DOMAIN` | 例: `mycompany.backlog.com` | ✅ |
| `BACKLOG_API_KEY` | Backlog 個人 API キー | ✅ |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console OAuth クライアント | ✅ |
| `GOOGLE_OAUTH_CLIENT_SECRET` | 同上 | ✅ |
| `GOOGLE_REFRESH_TOKEN` | OAuth Playground で取得 (スコープ: `calendar` / `drive.readonly` / `documents.readonly`) | ✅ |
| `SLACK_TOKENS_JSON` | 将来拡張用 (MVP では未使用) | — |
| `OPENAI_API_KEY` | 将来拡張用 (MVP では未使用) | — |
| `CLAUDE_CODE_PATH` | Claude Code CLI を AI プロバイダに使う場合 | — |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error` (既定は環境で自動切替) | — |

設定済みかどうかは `/settings` 画面の認証情報セクションで確認できます。

---

## 📋 主な機能

### ダッシュボード (`/`)

- 「今日やる」リスト (期限 ≤ 本日 + 手動フラグ、完了は自動除外、プロジェクト/キーワード絞り込み + 期限/優先度/更新日ソート)
- Google カレンダー (週ビュー既定、日/月ビュー切替可)
- カレンダーへ **チケット D&D で 60 分予定作成** (説明欄に Backlog チケット URL 自動埋込)
- 既存予定のドラッグ移動 / リサイズ / クリック削除
- 「+ チケット作成」モーダル (Backlog へ直接作成)
- 「Backlog から取り込み」(自分担当チケット + 親課題を補助取得)

### チケット一覧 (`/issues`)

- カードレイアウト、**子チケットは左にインデント + 親バッジ** (親子関係を視覚化)
- 行頭 **★ クリックで「今日やる」即トグル**
- フィルタ: キーワード / プロジェクト / ステータス (「完了以外」既定) / 優先度 / 期限 (期限切れ / 本日 / 今週 / 今月 / 期限なし)
- 並び替え: 期限 / 優先度 / 更新日 / キー / **親子順**
- 詳細パネルで Backlog の現在値を初期表示しつつ編集 (タイトル / 本文 / 期限 / 優先度 / 担当者 / カテゴリ / コメント追加)

### Markdown サポート

- 本文・コメントは Markdown エディタ (見出し / リスト / リンク / コード / テーブル等の GFM)
- プレビュー切替も搭載
- Backlog 側で Markdown フォーマットのプロジェクトと互換

### 設定 (`/settings`)

- 環境変数の設定状況を一覧 (`.env.local` 編集はファイル直編集)
- 自分の Backlog ユーザを **「自動取得」ボタン** で `users/myself` API から取得
- 対象 Backlog プロジェクト一覧
- 「処理中」相当ステータスのプロジェクト × Status ID マッピング

---

## 🧪 開発スクリプト

| コマンド | 用途 |
|----------|------|
| `npm run dev` | 開発サーバ起動 (http://localhost:3000) |
| `npm run build` | 本番ビルド (standalone output) |
| `npm run start` | 本番起動 |
| `npm run typecheck` | TypeScript 型チェック (`tsc --noEmit`) |
| `npm run lint` | ESLint (`next lint`) |
| `npm test` | Vitest 単体テスト |
| `docker compose --profile dev up -d --build` | Docker 開発モード |
| `docker compose --profile prod up -d --build` | Docker 本番ビルド |

---

## 📁 ディレクトリ構成

```
.
├── app/
│   ├── api/                  # Route Handler (Backlog / Google Calendar / Today / Settings)
│   ├── issues/               # チケット一覧
│   ├── settings/             # 設定
│   ├── manual/               # マニュアル (manual.md を SSR で MD レンダリング)
│   ├── layout.tsx            # 共通ヘッダ + ロゴ
│   └── page.tsx              # ダッシュボード
├── components/
│   ├── CalendarPane.tsx      # FullCalendar 統合 + D&D 受け
│   ├── TodayList.tsx         # 今日やるリスト
│   ├── IssueListClient.tsx   # チケット一覧 (カード + フィルタ + ソート)
│   ├── EditTicketModal.tsx   # 編集モーダル (一覧 / 今日やる共通)
│   ├── CreateTicketModal.tsx # 新規作成モーダル
│   ├── MarkdownEditor.tsx    # Markdown エディタ
│   ├── MarkdownView.tsx      # Markdown レンダリング
│   └── SettingsForm.tsx      # 設定フォーム
├── lib/
│   ├── clients/              # 外部 API クライアント (backlog / googleCalendar / googleAuth / _common)
│   ├── db/                   # SQLite アクセス層
│   ├── services/             # ビジネスロジック (backlogIssueService / todayService)
│   ├── types/                # 型定義 (backlog / ticket / settings / calendar / slack / meeting)
│   ├── utils/                # 共通ユーティリティ (issueStatus)
│   ├── validation/           # zod スキーマ
│   ├── http/response.ts      # 統一エラーレスポンス
│   ├── env.ts                # 環境変数ロード + 検証
│   ├── errors.ts             # 例外クラス階層
│   └── logger.ts             # pino ロガー (機密 redact)
├── migrations/               # SQLite マイグレーション (0001_init / 0002_parent / 0003_categories)
├── tests/                    # Vitest 単体テスト
├── docs/memo-flow/           # 設計成果物 (要件 / 基本 / 詳細 / テスト / レビュー)
├── public/logo.png           # アプリロゴ
├── Dockerfile                # 本番用 multi-stage build
├── Dockerfile.dev            # 開発用
├── docker-compose.yml        # dev / prod プロファイル
└── README.md                 # この本書
```

---

## 📐 設計

設計プロセスは [`docs/memo-flow/`](./docs/memo-flow/) に集約:

- [`01_requirements.md`](./docs/memo-flow/01_requirements.md) — 要件定義 (FR-001〜011)
- [`02_basic_design.md`](./docs/memo-flow/02_basic_design.md) — 基本設計 (BD-001〜010 + BD-100〜104)
- [`03_detailed_design.md`](./docs/memo-flow/03_detailed_design.md) — 詳細設計 (処理ID 単位)
- [`04_test_report.md`](./docs/memo-flow/04_test_report.md) — テストレポート
- [`05_review_report.md`](./docs/memo-flow/05_review_report.md) — レビューレポート

MVP 範囲外の機能 (Slack メンション取り込み / Meet 議事録 / AI 抽出 / Google Docs 取り込み) は設計だけ済んでおり、将来追加します。

---

## 🛟 トラブルシューティング

詳細はアプリ内 [`/manual`](http://localhost:3000/manual) ページに記載。代表的なもの:

| 症状 | 対処 |
|------|------|
| 環境変数が「未設定」のまま反映されない | `restart` ではなく `docker compose --profile dev up -d --force-recreate` |
| Google Calendar が 403 (`insufficientPermissions`) | `GOOGLE_REFRESH_TOKEN` を 3 スコープ全部で取り直して再投入 |
| Backlog 取り込みがスキップされる | 設定画面で「自分の Backlog ユーザ」を自動取得 → 保存 |
| キャッシュチケットだけ全削除したい | `docker compose --profile dev exec task-maestro-dev node -e "..."` (マニュアル参照) |

---

## 🗺️ ロードマップ

- ✅ MVP: Backlog 取り込み / 編集 / 今日やる / カレンダー D&D / 設定
- ⏳ Slack メンション取り込み (BD-001)
- ⏳ Google Meet 議事録 → ネクストアクション抽出 (BD-002)
- ⏳ Google Docs / Markdown ファイル → AI 抽出 (BD-007)
- ⏳ AI プロバイダ (OpenAI ⇄ Claude Code) 切替 (BD-009)

---

## 📄 ライセンス

プライベートプロジェクト (個人利用)。ライセンス指定なし。
