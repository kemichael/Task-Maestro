# Task Maestro マニュアル

Backlog をベースに、個人タスクを一元管理する Web アプリ「Task Maestro」の利用マニュアルです。

---

## 1. はじめに

Task Maestro は以下を 1 画面で完結させるツールです。

- **Backlog のチケットを横断表示・編集** (自分が担当のチケットのみ)
- **「今日やる」リストで本日着手するタスクを集約**
- **Google カレンダーへドラッグ&ドロップで予定化**
- **チケットを直接作成 / 編集 / コメント追加** (Markdown 対応)

外部連携: Backlog API / Google Calendar API / Google Drive API / Google Docs API。
ローカル動作 (自 PC 起動時のみ) で、追加サブスクリプションは不要です。

---

## 2. 初期セットアップ

### 2.1 必要な認証情報

`.env.local` (プロジェクト直下) に以下を設定してください。

| キー | 用途 | 必須 |
|------|------|:----:|
| `BACKLOG_SPACE_DOMAIN` | 例: `mycompany.backlog.com` | ✅ |
| `BACKLOG_API_KEY` | Backlog 個人 API キー | ✅ |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console で発行 | ✅ |
| `GOOGLE_OAUTH_CLIENT_SECRET` | 同上 | ✅ |
| `GOOGLE_REFRESH_TOKEN` | OAuth Playground で取得 (スコープ: calendar / drive.readonly / documents.readonly) | ✅ |
| `SLACK_TOKENS_JSON` | (MVP 後の拡張用、空でOK) | — |
| `OPENAI_API_KEY` | (MVP 後の拡張用、空でOK) | — |
| `CLAUDE_CODE_PATH` | Claude Code CLI の絶対パス、PATH 経由なら空でOK | — |

> 各キーの取り方は本マニュアル末尾の「付録: 認証情報の取得方法」を参照。

### 2.2 アプリ起動

#### Docker (推奨)

```bash
# 開発モード (ホットリロード)
docker compose --profile dev up -d --build

# 本番ビルド動作確認
docker compose --profile prod up -d --build
```

> ⚠️ `.env.local` を変更したら `docker compose --profile dev restart` ではなく
> `docker compose --profile dev up -d --force-recreate` で **コンテナを作り直してください**。
> `restart` だと env_file の変更が反映されません。

#### ローカル直接 (Node.js 20+)

```bash
npm install
cp .env.example .env.local   # 編集して値を埋める
npm run dev
```

### 2.3 設定画面で初期登録

ブラウザで [http://localhost:3000/settings](http://localhost:3000/settings) を開き、以下を設定:

1. **認証情報 (.env.local)** セクション — 5 つの必須キーが「設定済み」になっているか確認
2. **自分の Backlog ユーザ** — 「自動取得」ボタンで `users/myself` API から取得 → 「設定を保存」
3. **Backlog プロジェクト** — 対象プロジェクトの `projectId` (数値) を追加。表示名は任意
4. **ステータスマッピング** — プロジェクトごとに「処理中」相当の `statusId` を登録
   - 取得方法: ブラウザで `https://<space>.backlog.com/api/v2/projects/<projectId>/statuses?apiKey=<key>` を開く

---

## 3. 画面ガイド

### 3.1 ダッシュボード (`/`)

- 左ペイン: **「今日やる」リスト**
- 右ペイン: **Google カレンダー** (週ビュー)
- ヘッダ: **「+ チケット作成」「Backlog から取り込み」** ボタン

#### 「今日やる」リスト

- **抽出条件**: 期限 ≤ 本日 のチケット **+** 手動「今日」フラグ ON のチケット
- **完了チケットは自動的に除外**される (`statusId=4` / 名前が `完了 / Done / Closed / Resolved`)
- **検索ボックス** でキーワード絞り込み
- **プロジェクト絞り込み** セレクトで特定プロジェクトに限定可能
- **ソート**: 期限順 / 優先度順 / 更新日順 (▶ 「昇順 / 降順」トグル)
- **親課題**を持つチケットには「↑ 親キー: 親タイトル」が行内に表示
- **▶ ボタン**: そのチケットを「処理中」相当ステータスへ Backlog 側で遷移
- **「今日」チェックボックス**: 手動フラグ ON/OFF
- **ドラッグハンドル**: 行をつかんで右ペインのカレンダーへドロップ → 予定作成

### 3.2 チケット一覧 (`/issues`)

#### フィルタバー

- **キーワード検索**: タイトル / キー / 本文を部分一致検索
- **プロジェクト** / **優先度** の選択
- **ステータス**: 「全ステータス」「**完了以外**」「個別ステータス」から選択 (既定: 完了以外)
- **期限**: 期限切れ / 本日のみ / 今週中 / 今月中 / 期限なし / 全て
- **フィルタ解除** ボタン (= 既定の「完了以外」+ 期限「全て」に戻る)

#### 並び替え (フィルタバー直下)

ボタンをクリックで昇順 ⇄ 降順切替 (▲/▼)。

- **期限** / **優先度** / **更新日** / **キー** — 単純ソート
- **親子順** — 親チケットを先に、その直後に子チケットを並べる (孤児子チケットは親同様に扱う)

#### 親課題列

- 親課題を持つチケットには「親課題」列に **親キー + 親タイトル** を表示
- 親が自分担当でない場合も、同期時に補助取得してキャッシュするため表示可能
- 同期前 (古いキャッシュ) や Backlog 側で削除済みの場合は `#<親 ID>` のみ表示

#### 詳細パネル (行クリックで右側に展開)

各項目は **Backlog の現在値が初期表示** されます。値を変更したものだけが PATCH 対象になります。

- **タイトル**: テキスト入力
- **本文**: Markdown エディタ (見出し / 太字 / リスト / リンク / コード等)
  - **本文プレビュー** トグルでレンダリング結果を確認
- **期限**: 日付入力 (空欄で解除)
- **優先度**: 高 / 中 / 低
- **担当者 ID**: 数値入力 (空欄で未割当)
- **カテゴリ ID**: カンマ区切り (現在のカテゴリは ID とともに表示)
- **コメント追加**: Markdown エディタ
- **コメントのみ追加** ボタン → コメントだけ送信
- **保存** ボタン → 変更項目 + コメントを一括送信

#### 行内で「今日やる」を切替

各カード左の **星マーク (☆ / ★)** をクリックで「今日やる」フラグを ON/OFF できます。詳細パネルを開かなくてもワンクリックで操作可能。

#### 親子課題の表示

- 子チケット (= `parentIssueId` あり) は **左にインデント + 青いラインで親子関係を表示**
- カード上部に「↳ 親キー: 親タイトル」のバッジを表示

### 3.3 設定 (`/settings`)

- **認証情報セクション** — `.env.local` のキーごとに状態表示 (編集不可)
- **AI プロバイダ** — `openai` または `claudeCode`
- **自分の Backlog ユーザ** — ID + 表示名 + 自動取得ボタン
- **Backlog プロジェクト** — 対象プロジェクトの一覧管理
- **ステータスマッピング** — プロジェクト × 「処理中」ステータス ID

### 3.4 マニュアル (`/manual`)

このページ。

---

## 4. 操作チートシート

| やりたいこと | 操作 |
|--------------|------|
| Backlog の自分担当のチケットを取り込む | ダッシュボード / チケット一覧 のヘッダ「Backlog から取り込み」 |
| 新規チケットを作成 | ヘッダの「+ チケット作成」 → モーダルで入力 |
| 既存チケットを編集 | チケット一覧で行をクリック → 右パネルで編集 → 「保存」 |
| 本文に表・コードを書く | Markdown エディタで `\| col \| col \|` / ` ``` ` を使用 |
| 「今日やる」着手を Backlog に同期 | ダッシュボード左ペインの ▶ ボタン |
| チケットをカレンダーに配置 | チケット行をドラッグ → 右ペインにドロップ (60 分予定が作成) |
| 予定の時間移動 / リサイズ | カレンダー上の予定をドラッグ |
| 予定削除 | 予定をクリック → 確認ダイアログで OK |

---

## 5. トラブルシューティング

### 5.1 「環境変数のパースに失敗」

`.env.local` の値の書き方を確認。`KEY=value` 形式で、値を `"` で囲まない。改行 / 余分なスペースに注意。

### 5.2 認証情報が「未設定」のまま反映されない

`docker compose --profile dev restart` では `.env.local` の変更が反映されません。
**必ず `docker compose --profile dev up -d --force-recreate` を実行** してください。

### 5.3 Google Calendar が 403 で取得失敗 (`insufficientPermissions`)

`GOOGLE_REFRESH_TOKEN` が Calendar スコープを含んでいません。OAuth Playground で **3 つのスコープ** (`calendar` / `drive.readonly` / `documents.readonly`) を全部入れて Refresh Token を取り直し、`.env.local` を更新して `force-recreate`。

### 5.4 取り込みが「自分の Backlog ユーザ ID が未設定」でスキップされる

設定画面の「自分の Backlog ユーザ」セクションで「自動取得」 → 「設定を保存」。

### 5.5 Backlog から取得した古いチケットを全部消したい

```bash
docker compose --profile dev exec task-maestro-dev node -e "const Database = require('better-sqlite3'); const db = new Database('/app/data/task-maestro.sqlite'); console.log('Deleted:', db.prepare('DELETE FROM backlog_issue').run().changes); db.close();"
```

設定は保持されます。

---

## 付録: 認証情報の取得方法

### Backlog API キー

1. Backlog にログイン → 右上ユーザーアイコン → 「個人設定」
2. 左メニュー「API」 (`https://<space>.backlog.com/EditApiSettings.action`)
3. 「メモ」に用途を入力 → 「登録」 → 表示された API キーをコピー

### Google OAuth クライアント

1. [Google Cloud Console](https://console.cloud.google.com/) で新規プロジェクト作成
2. 「APIとサービス」→ ライブラリで以下を有効化:
   - Google Calendar API
   - Google Drive API
   - Google Docs API
3. 「OAuth 同意画面」を構成 (User Type: External、テストユーザに自分を追加)
4. 「認証情報」→「OAuth クライアント ID 作成」(タイプ: ウェブアプリ)
   - 承認済みリダイレクト URI: `https://developers.google.com/oauthplayground`
5. クライアント ID とシークレットを取得

### Google Refresh Token

1. [OAuth Playground](https://developers.google.com/oauthplayground) を開く
2. ⚙️ 歯車 → 「Use your own OAuth credentials」 → 自前の Client ID / Secret を入力
3. Step 1 の検索欄で **以下 3 つを 1 個ずつ Enter で追加**:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/documents.readonly`
4. 「Authorize APIs」 → 同意画面で許可
5. Step 2 「Exchange authorization code for tokens」 → Refresh token をコピー

---

## 6. 設計と実装

詳細な設計成果物は以下を参照:

- `docs/memo-flow/01_requirements.md` — 要件定義 (FR-001〜010)
- `docs/memo-flow/02_basic_design.md` — 基本設計 (BD-001〜010 + BD-100〜104)
- `docs/memo-flow/03_detailed_design.md` — 詳細設計
- `docs/memo-flow/04_test_report.md` — テストレポート
- `docs/memo-flow/05_review_report.md` — レビューレポート

MVP 範囲外の機能 (BD-001 Slack / BD-002 議事録 / BD-007 Docs取込 / BD-009 AI プロバイダ / BD-101 AI 抽出) は将来追加予定です。
