# Cyberpunk 2077 風デザインリニューアル 設計書

- 起票日: 2026-06-02
- 対象: Task Maestro 全画面の UI デザイン
- 目的: 既存のピンク/ブルー基調ダークテーマを、Cyberpunk 2077 を強く想起させる「黒 + 蛍光イエロー」基調へ全面リプレースする

---

## 1. 背景・ゴール

Task Maestro は現在 slate ベースのモダンダークテーマだが、ユーザーから Cyberpunk 2077 の公式ロゴ集 (黒地・蛍光イエロー・ハザードストライプ・クリップドコーナー・テクニカルラベル) を参考画像として「このスタイルにしたい」と要望があった。
本タスクでは、業務利用に耐えうる可読性を保ちながら、ガチゴチに振り切ったサイバーパンク風 UI へ全画面を作り変える。

### スコープ

- 対象: 全画面 (ダッシュボード / チケット一覧 / カンバン / マニュアル / 設定 / 各モーダル)
- 装飾レベル: フル (クリップドコーナー / ハザードストライプ / テクニカルラベル / ティック / スキャンライン / グリッチ / グロー)
- 機能変更なし。ビジュアル・トーンのみのリニューアル

### 非ゴール

- 機能追加・データモデル変更・新規画面の追加は行わない
- 配色の動的切替 (テーマ切替) は対象外

---

## 2. カラートークン (CSS Custom Properties)

既存の `--color-*` を全面置換する。

### サーフェス・ボーダー

```
--color-bg              : #000000        /* 純黒 */
--color-surface         : #0A0E14        /* ニア・ブラック (微かに青み) */
--color-surface-alt     : #14181F        /* hover / 浮かせる用 */
--color-surface-muted   : #0F1218        /* 沈ませる用 */
--color-border          : #2A2E36        /* くすんだスチール */
--color-border-strong   : #3A3F4A
--color-border-hot      : #FCEE0A        /* ホット (アクセント線) */
```

### メインアクセント (蛍光イエロー)

```
--color-accent          : #FCEE0A        /* ハイビズ・イエロー (Cyberpunk 2077 メイン) */
--color-accent-hot      : #FFFA38        /* hover時にさらに明るく */
--color-accent-deep     : #C9BD00        /* 沈ませ */
--color-accent-soft     : rgba(252, 238, 10, 0.12)
```

### サブアクセント

```
--color-cyan            : #00F0FF        /* TODO / 情報 / リンク */
--color-cyan-soft       : rgba(0, 240, 255, 0.14)
--color-magenta         : #FF003C        /* 期限切れ / 高優先 / エラー (レッド寄り) */
--color-magenta-soft    : rgba(255, 0, 60, 0.14)
--color-green-acid      : #39FF14        /* 完了 / 成功 (ネオン・グリーン) */
--color-green-soft      : rgba(57, 255, 20, 0.14)
--color-orange-warn     : #FF6B1A        /* 進行中 / 警告 */
--color-orange-soft     : rgba(255, 107, 26, 0.14)
```

### テキスト

```
--color-text            : #F5F5F5
--color-text-muted      : #8A9099
--color-text-subtle     : #5B616B
--color-text-on-yellow  : #0A0E14        /* 黄背景上の文字は黒 */
--color-text-on-primary : #0A0E14
```

### バッジマッピング (識別色を統一)

| 用途 | 色トークン |
| --- | --- |
| TODO | `--color-cyan` |
| 進行中 (in progress) | `--color-accent` |
| 解決済 (resolved) | `--color-green-acid` |
| 完了 / 対応不要 (done) | `--color-text-muted` |
| 高優先 (high) | `--color-magenta` |
| 通常 (normal) | グレー |
| 低優先 (low) | `--color-green-acid` (薄め) |
| 期限切れ (is-overdue) | `--color-magenta` ベース + 点滅 |
| 本日期限 (is-due-today) | `--color-accent` ベース |

---

## 3. タイポグラフィ

### フォント

```
--font-display : "Rajdhani", "Inter", system-ui, sans-serif       /* 見出し・ラベル・ボタン */
--font-sans    : "Inter", system-ui, sans-serif                    /* 本文 */
--font-mono    : "JetBrains Mono", ui-monospace, monospace         /* チケットキー・数値・テクニカルラベル */
```

- `next/font/google` で Rajdhani (400/500/600/700) と JetBrains Mono (400/500/600) を読み込み
- `app/layout.tsx` で `<html>` に CSS 変数として注入

### ルール

- 見出し (h1〜h3) は `--font-display` + `text-transform: uppercase` + `letter-spacing: 0.06em`
- h1 (ページタイトル) 下に蛍光イエローのアンダーバー (4px × 32px) + 上下ティック
- ボタン・タブラベルは Rajdhani Uppercase
- チケットキー (`PROJ-123`)、日付、数値は `--font-mono`
- 本文 (リード / カード本文 / フォームヘルプ) は Inter (可読性キープ)

---

## 4. 共通装飾要素 (Sigil)

ユーティリティクラスとして用意する。

### `.cyber-clip` / `.cyber-clip-sm`

- カードやボタンの左上・右下を斜めカット
- `.cyber-clip` (大カード / モーダル用): カット 12px
  - `clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)`
- `.cyber-clip-sm` (チケットカード / ボタン用): カット 8px
  - `clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)`
- 半径系のスタイルは無効化 (border-radius をリセット)

### `.cyber-hazard`

- 黒/黄の45度ストライプ
- `background: repeating-linear-gradient(45deg, #FCEE0A 0 12px, #000000 12px 24px)`
- 高さ 8px の細帯としてカード上端などに利用

### `.cyber-label`

- カード見出し前に出すテクニカルラベル
- 例: `TASK-FLAG →` / `ISSUE-ID →` / `DAILY OPS →`
- font: Mono 10px / color: `--color-accent` / letter-spacing: 0.1em / uppercase

### `.cyber-tick`

- 端のティックマーカー (短い縦線リピート)
- `background-image: repeating-linear-gradient(90deg, transparent 0 7px, var(--color-border) 7px 8px)`
- 高さ 8px のフッタ装飾として利用

### `.cyber-hot` (hover/active ホットボーダー)

- `border-color: var(--color-accent); box-shadow: 0 0 12px rgba(252, 238, 10, 0.45);`
- カード hover / focus 時に適用

### `.cyber-scanlines` (CRT スキャンライン)

- body 全体に `::before` でオーバーレイ
- `background: repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px); pointer-events: none;`

### `.cyber-glitch` (グリッチ)

- ロゴ・ページタイトル hover 時に発火
- `clip-path` ずらし + 色チャネル分離 (シアン/マゼンタ) を 0.3s で再生
- 4秒に1回ロゴで自動発火 (CSS animation)

### `.cyber-noise` (ノイズ背景)

- body の `::after` に SVG fractal noise を opacity 0.03 で敷く
- `pointer-events: none; mix-blend-mode: overlay;`

### `.cyber-corner` (コーナーアンカー)

- 大カードの四隅に `└ ┘ ┌ ┐` 風 L 字マーカーを擬似要素で配置
- 1px 黄色、12px × 12px

---

## 5. コンポーネント別適用方針

### ヘッダー (`app-header`)

- 上下に蛍光イエロー 1px ライン + ハザードストライプ 4px 帯
- ロゴ右に `// SYSTEM ONLINE` (Mono, グリーン) 常時表示
- ナビは Rajdhani Uppercase
- アクティブタブに黄色アンダーライン + グロー
- ロゴに `.cyber-glitch` を 4秒間隔で発火

### チケットカード (`issue-card`)

- `.cyber-clip` 適用
- 左端 3px 帯にステータス色 (シアン/イエロー/グリーン/グレー)
- 右上に `[PROJ-123]` チップ (Mono + 黄枠)
- カード見出し前に `.cyber-label` で `ISSUE →`
- hover で `.cyber-hot`
- `is-overdue` は赤いハザードストライプを上端に追加 + 1.2s 点滅 (reduced-motion で停止)
- `is-due-today` は黄ハザードストライプ

### 今日やる (`today-list`)

- リスト上部に `.cyber-label` で `[ DAILY OPS ] →`
- star ボタンは黄色 + hover で 12px グロー
- 各アイテムは `.cyber-clip` (小)

### カンバン (`kanban-board` / `kanban-column`)

- カラムヘッダーが `.cyber-hazard` 帯
- カラムタイトルは Rajdhani Uppercase
- カウンタチップは黄枠 + 黒文字
- ドラッグオーバー時にカラム全体に黄色グロー + ボーダー
- カード (kanban-card) は `.cyber-clip` (小)

### モーダル (`modal-backdrop` / `modal`)

- backdrop に強めのスキャンライン + ノイズ
- モーダル本体は `.cyber-clip` (大)
- ヘッダー下に `.cyber-hazard` 帯
- 右上 close ボタンは赤のクリップド四角 (`background: var(--color-magenta); color: #000`)

### ボタン

- `.primary-btn` → 黄背景 / 黒文字 / `.cyber-clip` / hover で `.cyber-hot`
- `.secondary-btn` → 黒背景 / 黄枠 / 黄文字 / `.cyber-clip`
- `.ghost-btn` → 透明 / 黄文字 / hover で薄黄背景

### フォーム

- input/select/textarea は黒地 + 黄細枠 (border: 1px solid `--color-border-strong`)
- focus 時に `--color-accent` 枠 + 12px グロー + 角に `└ ┘` コーナー出現
- ラベル (`form-field-label`) は Mono Uppercase + 黄色

### 設定画面 (`settings-form`)

- セクションタイトル前に `<<< SYSTEM CONFIG >>>` 風装飾 (Mono + 黄)
- 各セクションを `.cyber-clip` + 上端ハザード

### マニュアル (`manual-page`)

- 本文背景は黒、コードブロックは `--color-surface-alt` + 黄色のシンタックス強調
- リンクは黄色 + hover でグロー

### バッジ

- 既存クラス (`badge-todo` 等) を流用しつつ色を新パレットへ
- フォントは Mono Uppercase + letter-spacing 拡張

---

## 6. アニメーション・モーション

| 名前 | 仕様 |
| --- | --- |
| `logo-glitch` | ヘッダーロゴに 4 秒間隔 / 0.2s / `clip-path` ずらし + チャネル分離 |
| `overdue-pulse` | 期限切れカードの境界線が黄→赤に 1.2s ループ点滅 |
| `badge-scramble` | ステータスバッジ hover で 0.15s 文字スクランブル (擬似テキスト切替) |
| `page-scan` | ページ遷移時にスキャンラインが上から下へ 250ms 降下 |
| `focus-ring` | input フォーカス時に 12px 黄グロー (200ms ease-out) |
| `cyber-hot` | カード hover で 150ms で黄ボーダー + グロー |

### Reduced Motion 対応

- `@media (prefers-reduced-motion: reduce)` で以下を停止
  - `logo-glitch` / `overdue-pulse` / `badge-scramble` / `page-scan`
  - 残すのは `cyber-hot` / `focus-ring` の短いフェードのみ

---

## 7. アクセシビリティ

- 黄背景 (`#FCEE0A`) 上のテキストは必ず `--color-text-on-yellow` (黒) を使用し WCAG AA 達成
- スキャンライン / ノイズは opacity 0.03〜0.05 に抑制し可読性を阻害しない
- `is-overdue` の赤背景は AA を確保。点滅は reduced-motion で停止
- フォーカスリングは 3px 黄グロー (キーボード操作可視性)
- バッジ色は色のみに依存せず、テキストラベルも併記 (既存実装維持)

---

## 8. 実装方針

### 主な編集対象

- `app/globals.css` — ほぼ全面書き換え
- `app/layout.tsx` — Rajdhani / JetBrains Mono の `next/font/google` 読み込み追加
- 各コンポーネント (`components/*.tsx`) — クラス追加のみ
  - `.cyber-label` 表示用の `<span>` を見出しに挿入
  - `is-overdue` / `is-due-today` のクラス継続利用
  - 既存クラス名 (`.issue-card`, `.kanban-card`, `.today-item` 等) はそのまま流用

### 新規ユーティリティクラス

- `.cyber-clip` / `.cyber-clip-sm`
- `.cyber-hazard` / `.cyber-hazard-overlay`
- `.cyber-label`
- `.cyber-tick`
- `.cyber-hot`
- `.cyber-corner`
- `.cyber-glitch`
- `.cyber-scanlines` (body グローバル)
- `.cyber-noise` (body グローバル)

### グローバル装飾

- `body::before` にスキャンライン
- `body::after` にノイズ (SVG data URI)
- `html` 直下に CSS 変数注入

### コンポーネントへの最小編集

JSX は機能変更しない。装飾は CSS で完結させ、JSX 側はクラス追加と一部 `<span class="cyber-label">…</span>` の挿入のみに留める。

### テスト

- 視覚回帰なので Playwright / Storybook の自動テストは追加しない
- 確認は手動で全画面 (ダッシュボード / チケット一覧 / カンバン / マニュアル / 設定 / 各モーダル) を実機ブラウザで確認

---

## 9. リスクと対策

| リスク | 対策 |
| --- | --- |
| 視認性低下 (蛍光色の疲労感) | スキャンライン/ノイズを opacity 0.03〜0.05 に抑える。黄背景上の文字は黒固定 |
| 既存ステータス色との混乱 | バッジマッピング表に従い段階的に置換。文字ラベルは併記維持 |
| アニメーションによる業務阻害 | reduced-motion で点滅・グリッチ停止。常時動くのはロゴグリッチのみ (4秒間隔) |
| `clip-path` ブラウザ非対応 | 主要ブラウザはサポート済。フォールバックで矩形表示 (角丸無効) |
| フォント読み込み遅延 | `next/font` の `display: swap` を利用、Inter を fallback に維持 |

---

## 10. 完了基準

- 全画面 (ダッシュボード / チケット一覧 / カンバン / マニュアル / 設定 / 各モーダル) が新トークンで描画される
- ユーティリティクラス群が `app/globals.css` に実装されている
- Rajdhani / JetBrains Mono が読み込まれている
- `prefers-reduced-motion: reduce` 環境でアニメーションが停止する
- バッジ・期限切れ表示が新パレットで動作する
- 既存機能 (ドラッグ&ドロップ / モーダル開閉 / フォーム送信) が引き続き動作する
