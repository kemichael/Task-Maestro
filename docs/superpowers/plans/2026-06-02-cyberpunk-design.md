# Cyberpunk 2077 風デザインリニューアル 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Task Maestro 全画面の UI を Cyberpunk 2077 風 (黒 + 蛍光イエロー + フル装飾) に作り変える。

**Architecture:** `app/globals.css` のトークン・ベース要素・ユーティリティ・コンポーネント別スタイルを段階的に書き換える。`app/layout.tsx` で Rajdhani / JetBrains Mono を `next/font/google` 経由で読み込み、CSS 変数として注入する。JSX 側は `cyber-label` 等のクラス追加と一部 `<span>` 挿入のみで、機能変更は行わない。

**Tech Stack:** Next.js 15.1.3 (App Router) / React 19 / TypeScript / プレーン CSS (CSS Custom Properties) / next/font/google

**Spec:** `docs/superpowers/specs/2026-06-02-cyberpunk-design.md`

**前提:** 現在のブランチで作業を継続する (既に spec が同ブランチにコミット済み)。実装中は dev server (`npm run dev`) を立ち上げてブラウザ (http://localhost:3000) で各画面を目視確認すること。視覚回帰自動テストは導入しない。

---

## ファイル構造

### 編集対象

| ファイル | 種別 | 役割 |
| --- | --- | --- |
| `app/layout.tsx` | 修正 | Rajdhani / JetBrains Mono のフォント読み込みと CSS 変数注入 |
| `app/globals.css` | 修正 | 全面的なスタイル書き換え (トークン・ベース・ユーティリティ・各コンポーネント) |
| `components/IssueListClient.tsx` | 修正 | チケット見出しに `<span className="cyber-label">` を追加 |
| `components/TodayList.tsx` | 修正 | リスト先頭に `<span className="cyber-label">DAILY OPS →</span>` を追加 |
| `components/KanbanBoard.tsx` | 修正 | カラムタイトル前にテクニカルラベルを追加 |
| `components/LocalTaskList.tsx` | 修正 | メモタスクヘッダーにテクニカルラベル追加 |
| `components/SettingsForm.tsx` | 修正 | 各セクション見出しにテクニカルラベル追加 |

### 新規作成

なし。装飾はすべて既存 CSS と JSX のクラス追加で完結する。

---

## 共通の作業手順 (各タスクで適用)

各タスクは以下のパターンに従う:

1. **コード変更を適用**
2. **dev server で動作確認** — 起動済みでなければ `npm run dev` を起動。対象画面 (例: http://localhost:3000) をブラウザで開き、変更が反映されたか目視
3. **TypeScript チェック** — `npm run typecheck` (JSX 変更を含むタスクのみ)
4. **コミット**

dev server は最初の Task 1 開始時に起動して、最後の確認タスクまで起動しっぱなしで OK。

---

## Task 1: Rajdhani / JetBrains Mono フォントの導入

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: `app/layout.tsx` にフォント読み込みを追加**

`app/layout.tsx` を以下の内容に置き換える:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Rajdhani, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-google",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-google",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-google",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Task Maestro",
  description: "Backlog をベースにした個人タスク統合管理",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ja"
      className={`${inter.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <header className="app-header">
          <Link href="/" className="brand" aria-label="Task Maestro ホーム">
            <Image
              src="/logo.png"
              alt="Task Maestro"
              width={140}
              height={36}
              priority
              className="brand-logo"
            />
          </Link>
          <nav className="nav">
            <Link href="/">ダッシュボード</Link>
            <Link href="/kanban">カンバン</Link>
            <Link href="/issues">チケット一覧</Link>
            <Link href="/manual">マニュアル</Link>
            <Link href="/settings">設定</Link>
          </nav>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: TypeScript チェック**

Run: `npm run typecheck`
Expected: PASS (型エラーなし)

- [ ] **Step 3: 動作確認**

`npm run dev` を起動し、http://localhost:3000 をブラウザで開く。
- 開発者ツールの Network タブで Google Fonts (Rajdhani, JetBrainsMono, Inter) がダウンロードされていることを確認
- `<html>` 要素に `--font-display-google` / `--font-mono-google` / `--font-sans-google` が設定されていることを Elements タブで確認
- 見た目はまだ変わらないので OK (このタスクでは CSS で参照していないため)

- [ ] **Step 4: コミット**

```bash
git add app/layout.tsx
git commit -m "feat(design): Rajdhani / JetBrains Mono / Inter を next/font で読み込み"
```

---

## Task 2: カラートークン・ベースタイポグラフィの全面書き換え

**Files:**
- Modify: `app/globals.css` (冒頭の `:root` ブロック〜 `body` まで)

このタスクで設計書 §2 / §3 のカラートークンとフォント変数、`body` / `h1` / `h2` / `h3` / `a` の基本スタイルを完全に置き換える。

- [ ] **Step 1: `app/globals.css` の冒頭〜 `h3` ブロックまでを置換**

ファイル先頭から `h3 { ... }` ブロックの終端 (現行コード行 109 前後) までを、以下に置き換える:

```css
/* =============================================================
   Task Maestro — Cyberpunk 2077 風デザインシステム
   ============================================================= */

:root {
  color-scheme: dark;

  /* ===== サーフェス・ボーダー ===== */
  --color-bg: #000000;
  --color-surface: #0a0e14;
  --color-surface-alt: #14181f;
  --color-surface-hover: #14181f;
  --color-surface-muted: #0f1218;
  --color-border: #2a2e36;
  --color-border-strong: #3a3f4a;
  --color-border-hot: #fcee0a;

  /* ===== メインアクセント (蛍光イエロー) ===== */
  --color-accent: #fcee0a;
  --color-accent-hot: #fffa38;
  --color-accent-deep: #c9bd00;
  --color-accent-soft: rgba(252, 238, 10, 0.12);

  /* 互換: 旧 --color-primary 系のエイリアス */
  --color-primary: var(--color-accent);
  --color-primary-hover: var(--color-accent-hot);
  --color-primary-soft: var(--color-accent-soft);

  /* ===== サブアクセント ===== */
  --color-cyan: #00f0ff;
  --color-cyan-soft: rgba(0, 240, 255, 0.14);
  --color-magenta: #ff003c;
  --color-magenta-soft: rgba(255, 0, 60, 0.14);
  --color-green-acid: #39ff14;
  --color-green-soft: rgba(57, 255, 20, 0.14);
  --color-orange-warn: #ff6b1a;
  --color-orange-soft: rgba(255, 107, 26, 0.14);

  /* 互換: 旧 accent エイリアス */
  --color-accent-blue: var(--color-cyan);
  --color-accent-blue-soft: var(--color-cyan-soft);
  --color-accent-yellow: var(--color-accent);
  --color-accent-yellow-soft: var(--color-accent-soft);

  /* ===== テキスト ===== */
  --color-text: #f5f5f5;
  --color-text-muted: #8a9099;
  --color-text-subtle: #5b616b;
  --color-text-on-yellow: #0a0e14;
  --color-text-on-primary: #0a0e14;

  /* ===== セマンティック (互換用) ===== */
  --color-success: var(--color-green-acid);
  --color-success-soft: var(--color-green-soft);
  --color-danger: var(--color-magenta);
  --color-danger-soft: var(--color-magenta-soft);

  /* ===== 角丸: clip-path 採用のため小さめに ===== */
  --radius-sm: 0;
  --radius-md: 0;
  --radius-lg: 0;

  /* ===== シャドウ (グロー込み) ===== */
  --shadow-sm:
    0 1px 2px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(252, 238, 10, 0.04) inset;
  --shadow-md:
    0 4px 14px -2px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(252, 238, 10, 0.06) inset;
  --shadow-lg:
    0 18px 44px -8px rgba(0, 0, 0, 0.8),
    0 4px 14px -4px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(252, 238, 10, 0.08) inset;
  --shadow-glow: 0 0 12px rgba(252, 238, 10, 0.45);
  --shadow-glow-strong: 0 0 18px rgba(252, 238, 10, 0.7);
  --shadow-glow-danger: 0 0 12px rgba(255, 0, 60, 0.55);

  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;

  /* ===== フォント変数 ===== */
  --font-sans: var(--font-sans-google), "Inter", system-ui, -apple-system, "Segoe UI",
    Roboto, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif;
  --font-display: var(--font-display-google), "Rajdhani", var(--font-sans);
  --font-mono: var(--font-mono-google), "JetBrains Mono", ui-monospace, "SFMono-Regular",
    Menlo, Consolas, monospace;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  position: relative;
  min-height: 100vh;
}

/* CRT スキャンライン (グローバルオーバーレイ) */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.045) 0 1px,
    transparent 1px 3px
  );
  mix-blend-mode: overlay;
}

/* ノイズ背景 (グローバルオーバーレイ) */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  opacity: 0.04;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
}

a {
  color: var(--color-accent);
  text-decoration: none;
  transition: color 0.15s, text-shadow 0.15s;
}

a:hover {
  color: var(--color-accent-hot);
  text-shadow: var(--shadow-glow);
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text);
}

h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 var(--spacing-4);
  position: relative;
  display: inline-block;
  padding-bottom: 6px;
}

h1::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 48px;
  height: 4px;
  background: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 var(--spacing-3);
}

h3 {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 var(--spacing-2);
}
```

- [ ] **Step 2: 動作確認**

http://localhost:3000 を再読み込み。
- 背景が真っ黒になる
- 見出しが大文字化 + Rajdhani フォントに
- スキャンラインがうっすら全画面に走る (近づくと細い水平線が見える程度)
- ノイズが薄くかかる
- リンクが黄色に
- 既存レイアウトは崩れていない (色だけ変わる)

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "feat(design): カラートークンとベースタイポを Cyberpunk パレットに置換"
```

---

## Task 3: 共通ユーティリティクラスを追加

**Files:**
- Modify: `app/globals.css` (ベースタイポの直後に挿入)

設計書 §4 のユーティリティクラス群を追加する。

- [ ] **Step 1: `h3 { ... }` ブロックの直後に以下を追加**

```css
/* =============================================================
   Cyberpunk ユーティリティ
   ============================================================= */

/* クリップドコーナー */
.cyber-clip {
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
  border-radius: 0 !important;
}

.cyber-clip-sm {
  clip-path: polygon(
    8px 0,
    100% 0,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    0 100%,
    0 8px
  );
  border-radius: 0 !important;
}

/* ハザードストライプ帯 (黒/黄 45度) */
.cyber-hazard {
  background: repeating-linear-gradient(
    45deg,
    var(--color-accent) 0 12px,
    #000000 12px 24px
  );
  height: 8px;
}

.cyber-hazard-danger {
  background: repeating-linear-gradient(
    45deg,
    var(--color-magenta) 0 12px,
    #000000 12px 24px
  );
}

/* テクニカルラベル (XXX → 風) */
.cyber-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.cyber-label-cyan {
  color: var(--color-cyan);
}

/* ティックマーカー (端の目盛り) */
.cyber-tick {
  height: 8px;
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0 7px,
    var(--color-border) 7px 8px
  );
}

/* ホットボーダー (hover / focus 用) */
.cyber-hot {
  border-color: var(--color-accent) !important;
  box-shadow: var(--shadow-glow) !important;
}

/* グリッチ (ロゴ・タイトルで使用) */
@keyframes cyber-glitch {
  0%,
  92%,
  100% {
    transform: translate(0);
    text-shadow: none;
    clip-path: none;
  }
  93% {
    transform: translate(-2px, 0);
    text-shadow: 1px 0 var(--color-cyan), -1px 0 var(--color-magenta);
  }
  95% {
    transform: translate(2px, 0);
    text-shadow: -1px 0 var(--color-cyan), 1px 0 var(--color-magenta);
  }
  97% {
    transform: translate(-1px, 1px);
    text-shadow: 1px 0 var(--color-cyan), -1px 0 var(--color-magenta);
  }
}

.cyber-glitch {
  animation: cyber-glitch 4s steps(1, end) infinite;
}

/* コーナーアンカー (大カードの四隅に L 字) */
.cyber-corner {
  position: relative;
}

.cyber-corner::before,
.cyber-corner::after {
  content: "";
  position: absolute;
  width: 10px;
  height: 10px;
  border: 1px solid var(--color-accent);
  pointer-events: none;
}

.cyber-corner::before {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
}

.cyber-corner::after {
  bottom: 0;
  right: 0;
  border-left: none;
  border-top: none;
}
```

- [ ] **Step 2: 動作確認**

http://localhost:3000 を再読み込み。
- 見た目は変わらないが、開発者ツールで上記クラスが読み込まれていることを確認
- コンソールに CSS エラーが出ていないことを確認

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "feat(design): Cyberpunk 共通ユーティリティクラスを追加"
```

---

## Task 4: ヘッダーの Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (ヘッダーセクション)

- [ ] **Step 1: `app/globals.css` の `.app-header` 〜 `.app-main` ブロックを置換**

該当範囲 (現行コードの「ヘッダ」セクション) を以下に置き換える:

```css
/* =============================================================
   ヘッダ
   ============================================================= */

.app-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-6);
  padding: var(--spacing-3) var(--spacing-6);
  background: linear-gradient(180deg, #050709 0%, rgba(10, 14, 20, 0.92) 100%);
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
  border-top: 1px solid var(--color-accent);
  border-bottom: 1px solid var(--color-accent);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 0 rgba(252, 238, 10, 0.25);
}

.app-header::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -9px;
  height: 4px;
  background: repeating-linear-gradient(
    45deg,
    var(--color-accent) 0 12px,
    #000000 12px 24px
  );
}

.app-header .brand {
  display: inline-flex;
  align-items: center;
  position: relative;
}

.brand-logo {
  height: 32px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 6px rgba(252, 238, 10, 0.35));
  animation: cyber-glitch 4s steps(1, end) infinite;
}

.app-header .system-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--color-green-acid);
  text-transform: uppercase;
  text-shadow: 0 0 8px rgba(57, 255, 20, 0.5);
}

.app-header .nav {
  display: flex;
  gap: var(--spacing-1);
}

.app-header .nav a {
  position: relative;
  padding: var(--spacing-2) var(--spacing-3);
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  transition: color 0.15s, background 0.15s;
}

.app-header .nav a:hover {
  color: var(--color-accent);
  background: var(--color-accent-soft);
  text-shadow: var(--shadow-glow);
}

.app-header .nav a.is-active::after {
  content: "";
  position: absolute;
  left: var(--spacing-3);
  right: var(--spacing-3);
  bottom: 2px;
  height: 2px;
  background: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.app-main {
  padding: var(--spacing-6);
  max-width: 1500px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 2: ヘッダーに `// SYSTEM ONLINE` 表示を追加**

`app/layout.tsx` の `<Link href="/" className="brand" ...>` ブロックの直後に以下を挿入:

```tsx
          <span className="system-tag" aria-hidden="true">// SYSTEM ONLINE</span>
```

つまり:

```tsx
        <header className="app-header">
          <Link href="/" className="brand" aria-label="Task Maestro ホーム">
            <Image
              src="/logo.png"
              alt="Task Maestro"
              width={140}
              height={36}
              priority
              className="brand-logo"
            />
          </Link>
          <span className="system-tag" aria-hidden="true">// SYSTEM ONLINE</span>
          <nav className="nav">
            ...
```

- [ ] **Step 3: TypeScript チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: 動作確認**

http://localhost:3000 を再読み込み。
- ヘッダーが黄色の細い上下ライン + 下端にハザードストライプ
- ロゴに薄い黄色のドロップシャドウ + 4秒に1回うっすらグリッチ
- `// SYSTEM ONLINE` がロゴ右に緑文字で表示
- ナビが大文字 Rajdhani、hover で黄色になる

- [ ] **Step 5: コミット**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat(design): ヘッダーを Cyberpunk 化 (ハザード帯+グリッチロゴ+SYSTEM ONLINE)"
```

---

## Task 5: ボタンの Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (ボタンセクション)

- [ ] **Step 1: ボタンセクションを置換**

現行の「ボタン」セクション (button / .primary-btn / .secondary-btn / .ghost-btn) を以下に置き換える:

```css
/* =============================================================
   ボタン
   ============================================================= */

button {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  border-radius: 0;
  border: 1px solid transparent;
  padding: 8px 16px;
  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.05s,
    box-shadow 0.15s, text-shadow 0.15s;
  clip-path: polygon(
    8px 0,
    100% 0,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    0 100%,
    0 8px
  );
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

button:not(:disabled):active {
  transform: translateY(1px);
}

.primary-btn {
  background: var(--color-accent);
  color: var(--color-text-on-yellow);
  border-color: var(--color-accent);
}

.primary-btn:hover:not(:disabled) {
  background: var(--color-accent-hot);
  border-color: var(--color-accent-hot);
  box-shadow: var(--shadow-glow-strong);
}

.secondary-btn {
  background: transparent;
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.secondary-btn:hover:not(:disabled) {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-hot);
  color: var(--color-accent-hot);
  text-shadow: var(--shadow-glow);
}

.ghost-btn {
  background: transparent;
  color: var(--color-text-muted);
  border-color: transparent;
  clip-path: none;
}

.ghost-btn:hover:not(:disabled) {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  text-shadow: var(--shadow-glow);
}
```

- [ ] **Step 2: 動作確認**

http://localhost:3000 を再読み込みし、ダッシュボード等でボタンを確認。
- primary ボタンが黄色背景 / 黒文字 / クリップドコーナー
- secondary ボタンが透明背景 / 黄枠 / 黄文字 / クリップドコーナー
- hover で黄色グロー
- 大文字 Rajdhani 表示

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "feat(design): ボタンに Cyberpunk スタイル (クリップド+グロー) を適用"
```

---

## Task 6: バッジ・カード・キーチップの書き換え

**Files:**
- Modify: `app/globals.css` (カード / バナー / バッジ / キーチップセクション)

- [ ] **Step 1: 該当セクション (`.card` 〜 `.issue-key-chip` まで) を置換**

```css
/* =============================================================
   カード
   ============================================================= */

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
}

/* =============================================================
   バナー
   ============================================================= */

.error-banner {
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-magenta-soft);
  border-left: 4px solid var(--color-magenta);
  border-top: 1px solid rgba(255, 0, 60, 0.4);
  border-right: 1px solid rgba(255, 0, 60, 0.4);
  border-bottom: 1px solid rgba(255, 0, 60, 0.4);
  color: #ffb0bc;
  margin-bottom: var(--spacing-3);
  font-size: 13px;
  font-family: var(--font-mono);
}

.info-banner {
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-cyan-soft);
  border-left: 4px solid var(--color-cyan);
  border-top: 1px solid rgba(0, 240, 255, 0.4);
  border-right: 1px solid rgba(0, 240, 255, 0.4);
  border-bottom: 1px solid rgba(0, 240, 255, 0.4);
  color: #aef0ff;
  margin-bottom: var(--spacing-3);
  font-size: 13px;
  font-family: var(--font-mono);
}

.hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: var(--spacing-2);
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
}

/* =============================================================
   バッジ (識別色を Cyberpunk パレットに統一)
   ============================================================= */

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid transparent;
}

.badge-todo {
  background: var(--color-cyan-soft);
  color: var(--color-cyan);
  border-color: rgba(0, 240, 255, 0.5);
}

.badge-progress {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.badge-resolved {
  background: var(--color-green-soft);
  color: var(--color-green-acid);
  border-color: rgba(57, 255, 20, 0.5);
}

.badge-done {
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  border-color: var(--color-border-strong);
}

.badge-high {
  background: var(--color-magenta-soft);
  color: var(--color-magenta);
  border-color: var(--color-magenta);
}

.badge-normal {
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  border-color: var(--color-border);
}

.badge-low {
  background: var(--color-green-soft);
  color: var(--color-green-acid);
  border-color: rgba(57, 255, 20, 0.3);
}

.badge-muted {
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  border-color: var(--color-border);
}

/* =============================================================
   キーチップ (PROJ-123 表示)
   ============================================================= */

.issue-key-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--color-accent);
  color: var(--color-text-on-yellow);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  flex-shrink: 0;
  clip-path: polygon(
    4px 0,
    100% 0,
    100% calc(100% - 4px),
    calc(100% - 4px) 100%,
    0 100%,
    0 4px
  );
}

.issue-key-chip.large {
  font-size: 12px;
  padding: 4px 10px;
}
```

- [ ] **Step 2: 動作確認**

ダッシュボードを表示し、チケットキーチップ・バッジ類を目視確認。
- バッジが小文字→大文字 + Mono フォント
- 高優先=赤、進行中=黄、TODO=シアン、完了=グリーンになる
- キーチップが黄背景・黒文字・クリップド

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "feat(design): カード/バナー/バッジ/キーチップを Cyberpunk 化"
```

---

## Task 7: フォーム入力の Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (フォームセクション)

- [ ] **Step 1: フォームセクション (`.form-field` 〜 `textarea:focus`) を置換**

```css
/* =============================================================
   フォーム
   ============================================================= */

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: var(--spacing-3);
}

.form-field-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.form-row {
  display: flex;
  gap: var(--spacing-3);
}

.form-row > .form-field {
  flex: 1;
}

input[type="text"],
input[type="number"],
input[type="date"],
input[type="email"],
select,
textarea {
  padding: 8px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: 0;
  font-size: 13px;
  font-family: var(--font-mono);
  background: var(--color-surface);
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}

input[type="text"]:focus,
input[type="number"]:focus,
input[type="date"]:focus,
input[type="email"]:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}
```

- [ ] **Step 2: 動作確認**

設定画面 (http://localhost:3000/settings) を開き、入力フィールドを確認。
- ラベルが黄色 Mono Uppercase
- 入力欄が黒地 + グレー枠 + Mono フォント
- フォーカス時に黄枠 + グロー

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "feat(design): フォーム入力を Cyberpunk 化 (黄ラベル+グローフォーカス)"
```

---

## Task 8: モーダルの Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (モーダルセクション)

- [ ] **Step 1: モーダルセクション (`.modal-backdrop` 〜 `.today-item-actions`) を置換**

```css
/* =============================================================
   モーダル
   ============================================================= */

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-backdrop::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.06) 0 1px,
    transparent 1px 3px
  );
  mix-blend-mode: overlay;
}

.modal {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  padding: var(--spacing-6);
  width: 560px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  clip-path: polygon(
    14px 0,
    100% 0,
    100% calc(100% - 14px),
    calc(100% - 14px) 100%,
    0 100%,
    0 14px
  );
}

.modal::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 4px;
  background: repeating-linear-gradient(
    45deg,
    var(--color-accent) 0 12px,
    #000000 12px 24px
  );
  pointer-events: none;
}

.modal h2 {
  margin-bottom: var(--spacing-4);
}

.modal form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.modal label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-2);
  margin-top: var(--spacing-3);
  flex-wrap: wrap;
}

.modal-edit {
  width: 720px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-3);
  padding-bottom: var(--spacing-3);
  border-bottom: 1px dashed var(--color-border-strong);
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.modal-close {
  font-size: 14px;
  padding: 4px 10px;
  line-height: 1;
  background: var(--color-magenta);
  color: #000;
  border-color: var(--color-magenta);
}

.modal-close:hover:not(:disabled) {
  background: #ff3360;
  border-color: #ff3360;
  box-shadow: var(--shadow-glow-danger);
}

.icon-btn {
  padding: 4px 8px;
  font-size: 12px;
}

.today-item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: 動作確認**

ダッシュボード等で「新規チケット」ボタンなどを押してモーダルを開く。
- backdrop に強いスキャンライン
- モーダル本体がクリップドコーナー + 上端ハザードストライプ
- 閉じる (X) ボタンが赤い

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "feat(design): モーダルを Cyberpunk 化 (ハザード上端+赤クローズ)"
```

---

## Task 9: ダッシュボード・今日やる・メモタスクの Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (ダッシュボード / 今日やる / メモタスクセクション)
- Modify: `components/TodayList.tsx`
- Modify: `components/LocalTaskList.tsx`

- [ ] **Step 1: `app/globals.css` の該当セクションを置換**

「ダッシュボード」セクションから「メモタスク」セクション末尾まで:

```css
/* =============================================================
   ダッシュボード
   ============================================================= */

.dashboard-header,
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-4);
  gap: var(--spacing-4);
}

.dashboard-actions,
.page-actions {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: var(--spacing-4);
}

.dashboard-left,
.dashboard-right {
  background: var(--color-surface);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  position: relative;
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
}

.dashboard-left::before,
.dashboard-right::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  background: repeating-linear-gradient(
    45deg,
    var(--color-accent) 0 10px,
    #000000 10px 20px
  );
  pointer-events: none;
}

/* =============================================================
   今日やる
   ============================================================= */

.today-controls {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  margin-bottom: var(--spacing-3);
  flex-wrap: wrap;
}

.today-controls .today-search {
  flex: 1;
  min-width: 120px;
}

.today-empty {
  padding: var(--spacing-6);
  text-align: center;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-surface-muted);
  border: 1px dashed var(--color-border-strong);
}

.today-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.today-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s;
  clip-path: polygon(
    8px 0,
    100% 0,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    0 100%,
    0 8px
  );
}

.today-item:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.today-item:active {
  cursor: grabbing;
}

.today-item .check-btn {
  padding: 4px 8px;
  font-size: 10px;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  flex-shrink: 0;
}

.today-item .check-btn:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-text-on-yellow);
}

.today-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.today-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.today-meta-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.today-flag {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

/* =============================================================
   メモタスク
   ============================================================= */

.local-tasks {
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-3);
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  position: relative;
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
}

.local-tasks::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  background: repeating-linear-gradient(
    45deg,
    var(--color-accent) 0 10px,
    #000000 10px 20px
  );
}

.local-tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-2);
}

.local-tasks-title {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.local-task-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  margin-bottom: var(--spacing-2);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.local-task-form input[type="text"],
.local-task-form textarea,
.local-task-edit input[type="text"],
.local-task-edit textarea {
  width: 100%;
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 13px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.local-task-form textarea,
.local-task-edit textarea {
  resize: vertical;
  min-height: 40px;
}

.local-task-form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.local-task-form-row label {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
}

.local-task-form-actions {
  display: flex;
  gap: var(--spacing-2);
}

.local-task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.local-task-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s;
  clip-path: polygon(
    8px 0,
    100% 0,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    0 100%,
    0 8px
  );
}

.local-task-item:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.local-task-item:active {
  cursor: grabbing;
}

.local-task-item.completed {
  opacity: 0.5;
}

.local-task-item.completed .local-task-title {
  text-decoration: line-through;
}

.local-task-check {
  margin-top: 3px;
  flex-shrink: 0;
  accent-color: var(--color-accent);
}

.local-task-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.local-task-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  word-break: break-word;
}

.local-task-notes-wrap {
  position: relative;
}

.local-task-notes {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: help;
}

.local-task-notes-popup {
  display: none;
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  left: 0;
  min-width: 320px;
  max-width: 640px;
  max-height: 420px;
  overflow: auto;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-accent);
  box-shadow: var(--shadow-lg);
  color: var(--color-text);
}

.local-task-notes-popup .markdown-body {
  font-size: 12.5px;
}

.local-task-notes-popup .markdown-body > *:first-child {
  margin-top: 0;
}

.local-task-notes-popup .markdown-body > *:last-child {
  margin-bottom: 0;
}

.local-task-notes-wrap:hover .local-task-notes-popup,
.local-task-notes-wrap:focus-within .local-task-notes-popup {
  display: block;
}

.local-task-due {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.local-task-edit {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  min-width: 0;
}

.local-task-actions {
  display: flex;
  gap: var(--spacing-1);
  flex-shrink: 0;
}
```

- [ ] **Step 2: `components/TodayList.tsx` を読んでテクニカルラベル追加位置を確認**

`components/TodayList.tsx` を Read で開いて、`<h2>` または「今日やる」見出しが描画される箇所を特定。
見出しが `<h2>今日やる</h2>` のような形なら、その直前に `<span className="cyber-label">DAILY OPS →</span>` を挿入する。

実装例 (該当箇所が `<h2>今日やる</h2>` の場合):

```tsx
<div className="today-heading-row">
  <span className="cyber-label">DAILY OPS →</span>
  <h2>今日やる</h2>
</div>
```

具体的な見出し JSX 構造はファイルを確認の上、ラベルを差し込みやすい位置 (見出しの直前) に追加すること。

- [ ] **Step 3: `components/LocalTaskList.tsx` を読んでテクニカルラベル追加位置を確認**

`components/LocalTaskList.tsx` の `.local-tasks-header` ブロック内、`<div className="local-tasks-title">…</div>` の前に以下を追加:

```tsx
<span className="cyber-label" style={{ marginRight: 8 }}>MEMO OPS →</span>
```

- [ ] **Step 4: TypeScript チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: 動作確認**

http://localhost:3000 を再読み込み。
- 左右パネルの上端にハザードストライプ
- パネルはクリップドコーナー
- 「DAILY OPS →」「MEMO OPS →」が黄色 Mono で見出し前に表示
- 今日やるアイテム / メモタスクアイテムが小クリップド、hover で黄グロー

- [ ] **Step 6: コミット**

```bash
git add app/globals.css components/TodayList.tsx components/LocalTaskList.tsx
git commit -m "feat(design): ダッシュボード/今日やる/メモタスクを Cyberpunk 化"
```

---

## Task 10: チケット一覧画面の Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (チケット一覧セクション)
- Modify: `components/IssueListClient.tsx`

- [ ] **Step 1: `app/globals.css` のチケット一覧セクション (`.issue-list-layout` 〜 `.current-categories`) を置換**

```css
/* =============================================================
   チケット一覧
   ============================================================= */

.issue-list-layout {
  display: flex;
  gap: var(--spacing-4);
  align-items: flex-start;
}

.issue-list-main {
  flex: 1;
  min-width: 0;
}

.filter-bar {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  flex-wrap: wrap;
  padding: var(--spacing-3) var(--spacing-4);
  margin-bottom: var(--spacing-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  clip-path: polygon(
    10px 0,
    100% 0,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    0 100%,
    0 10px
  );
}

.filter-keyword {
  min-width: 240px;
  flex: 1;
}

.filter-summary {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-2);
  padding-left: var(--spacing-2);
}

.filter-count {
  color: var(--color-accent);
  font-weight: 700;
}

.sort-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  flex-wrap: wrap;
  margin: 0 0 var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  clip-path: polygon(
    10px 0,
    100% 0,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    0 100%,
    0 10px
  );
}

.sort-label {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-accent);
  margin-right: var(--spacing-2);
}

.sort-btn {
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  clip-path: none;
  border-radius: 0;
}

.sort-btn:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
  border-color: var(--color-border-strong);
}

.sort-btn.is-active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-text-on-yellow);
  font-weight: 700;
}

.issue-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.empty-card {
  padding: var(--spacing-6);
  text-align: center;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  border: 1px dashed var(--color-border-strong);
  background: var(--color-surface-muted);
}

.issue-card {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.05s;
  position: relative;
  clip-path: polygon(
    10px 0,
    100% 0,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    0 100%,
    0 10px
  );
}

.issue-card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.issue-card.is-selected {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow-strong);
}

.issue-card-child {
  margin-left: var(--spacing-6);
  border-left: 3px solid var(--color-cyan);
}

.issue-card-child::before {
  content: "";
  position: absolute;
  left: -19px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(
    to bottom,
    transparent,
    var(--color-border) 20%,
    var(--color-border) 80%,
    transparent
  );
}

.issue-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.issue-card-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.issue-card-title {
  font-weight: 500;
  color: var(--color-text);
  word-break: break-word;
  flex: 1;
}

.issue-card-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.meta-due,
.meta-assignee {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.meta-categories {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.category-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* 星マーク (今日やる) */
.star-btn {
  background: transparent;
  border: none;
  color: var(--color-text-subtle);
  font-size: 20px;
  line-height: 1;
  padding: 4px;
  cursor: pointer;
  transition: color 0.15s, transform 0.1s, text-shadow 0.15s;
  flex-shrink: 0;
  clip-path: none;
}

.star-btn:hover:not(:disabled) {
  color: var(--color-accent);
  transform: scale(1.15);
  text-shadow: var(--shadow-glow);
}

.star-btn.is-on {
  color: var(--color-accent);
  text-shadow: var(--shadow-glow);
}

.star-btn.is-on:hover:not(:disabled) {
  color: var(--color-accent-hot);
}

/* 親課題チップ */
.parent-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  width: fit-content;
  max-width: 100%;
}

.parent-chip-today {
  align-self: flex-start;
}

.parent-chip-detail {
  margin-bottom: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  font-size: 11px;
}

.parent-arrow {
  color: var(--color-cyan);
  font-weight: bold;
}

.parent-key {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-cyan);
}

.parent-name {
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parent-unresolved {
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
}

/* 詳細パネル */
.issue-detail {
  width: 420px;
  flex-shrink: 0;
  padding: var(--spacing-5);
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
}

.issue-detail-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
  flex-wrap: wrap;
}

.issue-detail-actions {
  display: flex;
  gap: var(--spacing-2);
  justify-content: flex-end;
  margin-top: var(--spacing-3);
}

.current-categories {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-3);
  padding: var(--spacing-2);
  background: var(--color-surface-muted);
  border: 1px dashed var(--color-border-strong);
}
```

- [ ] **Step 2: `components/IssueListClient.tsx` でチケットカードタイトル前にテクニカルラベルを追加**

`components/IssueListClient.tsx` を Read で開き、`.issue-card-title` を描画している `<div>` または `<h3>` を探す。そのタイトル要素の直前 (同じ `.issue-card-title-row` 内、ただしキーチップやステータスバッジの後) に以下を挿入:

```tsx
<span className="cyber-label">ISSUE →</span>
```

挿入箇所は `issue-card-title-row` の中で、issue-key-chip の隣あたりが視覚的にバランスがよい。

- [ ] **Step 3: TypeScript チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: 動作確認**

http://localhost:3000/issues を開く。
- フィルタバー / ソートバー / カード全てクリップド
- カードに `ISSUE →` ラベルがタイトル横に表示
- hover で黄色グロー
- 子課題は左にシアン3px帯
- 選択時は強いグロー

- [ ] **Step 5: コミット**

```bash
git add app/globals.css components/IssueListClient.tsx
git commit -m "feat(design): チケット一覧画面を Cyberpunk 化"
```

---

## Task 11: カンバン画面の Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (カンバンセクション)
- Modify: `components/KanbanBoard.tsx`

- [ ] **Step 1: `app/globals.css` のカンバンセクション (`.kanban-page` 〜 `.confirm-candidates`) を置換**

```css
/* =============================================================
   カンバン
   ============================================================= */

.kanban-page .dashboard-header {
  margin-bottom: var(--spacing-4);
}

.kanban-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.kanban-done-scope {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.kanban-done-scope select {
  padding: 4px 6px;
  font-size: 11px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-family: var(--font-mono);
}

.kanban-mode-switch {
  display: inline-flex;
  border: 1px solid var(--color-accent);
  overflow: hidden;
  background: var(--color-surface);
  clip-path: polygon(
    8px 0,
    100% 0,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    0 100%,
    0 8px
  );
}

.kanban-mode-switch .mode-tab {
  padding: var(--spacing-2) var(--spacing-4);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  border-right: 1px solid var(--color-accent);
  background: transparent;
  border-radius: 0;
  clip-path: none;
  transition: background 0.15s, color 0.15s;
}

.kanban-mode-switch .mode-tab:last-child {
  border-right: none;
}

.kanban-mode-switch .mode-tab:hover {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.kanban-mode-switch .mode-tab.active {
  background: var(--color-accent);
  color: var(--color-text-on-yellow);
}

.kanban-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.kanban-pending {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
}

.kanban-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: var(--spacing-3);
  align-items: flex-start;
}

.kanban-column {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  padding: var(--spacing-2);
  min-height: 240px;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  position: relative;
  clip-path: polygon(
    10px 0,
    100% 0,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    0 100%,
    0 10px
  );
}

.kanban-column::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 4px;
  background: repeating-linear-gradient(
    45deg,
    var(--color-accent) 0 10px,
    #000000 10px 20px
  );
  pointer-events: none;
}

.kanban-column.drag-over {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow-strong);
}

.kanban-column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-2);
  margin-bottom: var(--spacing-2);
  margin-top: 4px;
}

.kanban-column-title {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
}

.kanban-column-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-on-yellow);
  background: var(--color-accent);
  padding: 1px 8px;
  border: 1px solid var(--color-accent);
  font-weight: 700;
}

.kanban-column-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.kanban-empty {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-subtle);
  padding: var(--spacing-4);
  border: 1px dashed var(--color-border-strong);
}

.kanban-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--spacing-2) var(--spacing-3);
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.05s;
  clip-path: polygon(
    7px 0,
    100% 0,
    100% calc(100% - 7px),
    calc(100% - 7px) 100%,
    0 100%,
    0 7px
  );
}

.kanban-card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.kanban-card:active {
  cursor: grabbing;
}

.kanban-card-local {
  border-left: 3px solid var(--color-accent);
}

.kanban-card-backlog {
  border-left: 3px solid var(--color-cyan);
}

.kanban-card-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.kanban-card-status {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}

.kanban-local-chip {
  background: var(--color-accent);
  color: var(--color-text-on-yellow);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  letter-spacing: 0.06em;
}

.kanban-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  word-break: break-word;
}

.kanban-card-notes-wrap {
  position: relative;
}

.kanban-card-notes {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: help;
}

.kanban-card-notes-popup {
  display: none;
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  left: 0;
  min-width: 300px;
  max-width: 600px;
  max-height: 420px;
  overflow: auto;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-accent);
  box-shadow: var(--shadow-lg);
  color: var(--color-text);
}

.kanban-card-notes-popup .markdown-body {
  font-size: 12.5px;
}

.kanban-card-notes-popup .markdown-body > *:first-child {
  margin-top: 0;
}

.kanban-card-notes-popup .markdown-body > *:last-child {
  margin-bottom: 0;
}

.kanban-card-notes-wrap:hover .kanban-card-notes-popup,
.kanban-card-notes-wrap:focus-within .kanban-card-notes-popup {
  display: block;
}

.kanban-card-due {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}

.confirm-candidates {
  list-style: none;
  padding: 0;
  margin: var(--spacing-3) 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.confirm-candidates button {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
}
```

- [ ] **Step 2: `components/KanbanBoard.tsx` でカラムヘッダー内のタイトルをテクニカルラベル化**

`components/KanbanBoard.tsx` を Read で開き、`.kanban-column-title` を描画している箇所を確認。
その要素の直前または同要素のテキスト前に `→` プレフィックスを追加する。具体的には、`<div className="kanban-column-title">{column.name}</div>` を以下に変更:

```tsx
<div className="kanban-column-title">
  <span className="cyber-label" style={{ marginRight: 6 }}>STAGE →</span>
  {column.name}
</div>
```

- [ ] **Step 3: TypeScript チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: 動作確認**

http://localhost:3000/kanban を開く。
- カラム上端にハザードストライプ
- カラムタイトルが黄色 Uppercase Rajdhani、前に `STAGE →` ラベル
- カウンタチップが黄背景・黒文字
- カードがクリップド + hover で黄グロー
- ドラッグ時にカラム全体に強いグロー
- モード切替タブが黄枠 + アクティブで黄背景

- [ ] **Step 5: コミット**

```bash
git add app/globals.css components/KanbanBoard.tsx
git commit -m "feat(design): カンバン画面を Cyberpunk 化"
```

---

## Task 12: 設定画面・カンバンマッピングの Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (設定 / カンバンマッピングセクション)
- Modify: `components/SettingsForm.tsx`

- [ ] **Step 1: `app/globals.css` の設定 / カンバンマッピングセクションを置換**

```css
/* =============================================================
   設定画面
   ============================================================= */

.env-table {
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 12px;
  margin-bottom: var(--spacing-4);
  width: 100%;
}

.env-table th {
  text-align: left;
  font-weight: 600;
  color: var(--color-accent);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.env-table th,
.env-table td {
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
}

.status-ok {
  color: var(--color-green-acid);
  font-weight: 700;
  text-shadow: 0 0 6px rgba(57, 255, 20, 0.5);
}

.status-missing {
  color: var(--color-magenta);
  font-weight: 700;
}

.settings-form section {
  margin-bottom: var(--spacing-5);
  padding: var(--spacing-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  position: relative;
  box-shadow: var(--shadow-sm);
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
}

.settings-form section::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  background: repeating-linear-gradient(
    45deg,
    var(--color-accent) 0 10px,
    #000000 10px 20px
  );
  pointer-events: none;
}

.settings-form .row {
  display: flex;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-2);
  flex-wrap: wrap;
}

.settings-form .row input {
  flex: 1;
  min-width: 120px;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
}

.sync-button-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.sync-message {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-green-acid);
}

.sync-error {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-magenta);
}

/* =============================================================
   カンバンマッピング
   ============================================================= */

.kanban-mapping-editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.kanban-mapping-project {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  padding: var(--spacing-3);
}

.kanban-mapping-project-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-2);
}

.kanban-mapping-project-header .spacer {
  flex: 1;
}

.kanban-mapping-project-header .muted {
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: 10px;
}

.kanban-mapping-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 11px;
}

.kanban-mapping-table th,
.kanban-mapping-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
}

.kanban-mapping-table th {
  color: var(--color-accent);
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.status-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 0;
  margin-right: 6px;
  vertical-align: middle;
  box-shadow: 0 0 6px currentColor;
}

.local-task-status {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 2px 4px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.local-task-status[data-status="done"] {
  background: var(--color-green-soft);
  color: var(--color-green-acid);
  border-color: var(--color-green-acid);
}

.local-task-status[data-status="in_progress"] {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.local-task-status[data-status="resolved"] {
  background: var(--color-cyan-soft);
  color: var(--color-cyan);
  border-color: var(--color-cyan);
}
```

- [ ] **Step 2: `components/SettingsForm.tsx` の各 `<section>` 内見出し前にテクニカルラベル追加**

`components/SettingsForm.tsx` を Read で開く。`<section>` ごとに `<h2>` または見出しがあるはず。各見出しの直前に以下を追加:

```tsx
<span className="cyber-label" style={{ display: "block", marginBottom: 6 }}>&lt;&lt;&lt; SYSTEM CONFIG &gt;&gt;&gt;</span>
```

セクションが複数あるなら、それぞれの見出しごとに同じ要領で挿入する。セクションテーマに応じて文言を変えてもよい (例: `<<< BACKLOG / API >>>`, `<<< GOOGLE / CALENDAR >>>` など。文言判断はファイル内のコメントや見出しテキストを参照)。

- [ ] **Step 3: TypeScript チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: 動作確認**

http://localhost:3000/settings を開く。
- 各セクションがクリップド + 上端ハザード
- 見出し前に `<<< SYSTEM CONFIG >>>` 風ラベル
- env テーブルのヘッダが黄 Uppercase
- ステータス OK / Missing が緑/赤グロー

- [ ] **Step 5: コミット**

```bash
git add app/globals.css components/SettingsForm.tsx
git commit -m "feat(design): 設定画面とカンバンマッピングを Cyberpunk 化"
```

---

## Task 13: マニュアル・Markdown・カレンダー・スクロールバーの Cyberpunk 化

**Files:**
- Modify: `app/globals.css` (Markdown / マニュアル / カレンダー / スクロールバー)

- [ ] **Step 1: 該当セクションを置換**

```css
/* =============================================================
   Markdown
   ============================================================= */

.plain-markdown-editor {
  width: 100%;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  white-space: pre-wrap;
}

.markdown-body {
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text);
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-accent);
}

.markdown-body pre {
  background: #000;
  padding: var(--spacing-3);
  border-left: 3px solid var(--color-accent);
  border-top: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  font-family: var(--font-mono);
  color: var(--color-green-acid);
}

.markdown-body code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-accent);
}

.markdown-body table {
  border-collapse: collapse;
  margin: 0.5em 0;
}

.markdown-body table th,
.markdown-body table td {
  border: 1px solid var(--color-border);
  padding: 4px 8px;
}

.markdown-body table th {
  color: var(--color-accent);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.06em;
}

.markdown-body blockquote {
  border-left: 3px solid var(--color-accent);
  padding-left: var(--spacing-3);
  color: var(--color-text-muted);
  margin-left: 0;
  background: var(--color-accent-soft);
  padding-top: var(--spacing-2);
  padding-bottom: var(--spacing-2);
}

.markdown-body a {
  color: var(--color-cyan);
  text-decoration: underline;
}

.markdown-body a:hover {
  color: var(--color-cyan);
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.6);
}

.markdown-empty {
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: 11px;
}

.markdown-preview-toggle {
  margin: var(--spacing-1) 0 var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px dashed var(--color-border-strong);
  background: var(--color-surface-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.markdown-preview-toggle summary {
  cursor: pointer;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.markdown-preview-toggle[open] summary {
  margin-bottom: var(--spacing-2);
}

/* =============================================================
   マニュアル
   ============================================================= */

.manual-page {
  max-width: 880px;
}

.manual-page .markdown-body {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  position: relative;
  clip-path: polygon(
    14px 0,
    100% 0,
    100% calc(100% - 14px),
    calc(100% - 14px) 100%,
    0 100%,
    0 14px
  );
}

/* =============================================================
   カレンダー
   ============================================================= */

.calendar-pane {
  font-family: var(--font-mono);
  font-size: 12px;
}

.calendar-pane .fc-toolbar-title {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
}

.calendar-pane .fc-button {
  background: transparent;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.calendar-pane .fc-button:hover {
  background: var(--color-accent-soft);
  color: var(--color-accent-hot);
}

.calendar-pane .fc-button-active {
  background: var(--color-accent) !important;
  color: var(--color-text-on-yellow) !important;
}

/* =============================================================
   スクロールバー
   ============================================================= */

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border: 2px solid var(--color-bg);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent);
}
```

- [ ] **Step 2: 動作確認**

http://localhost:3000/manual を開く。
- マニュアル本文がクリップドコーナー
- コードブロックが黒地 + 黄左罫 + 緑文字
- 引用が黄罫 + 薄黄背景
- リンクがシアン

ダッシュボードでカレンダーを表示。
- カレンダーツールバーが黄 Uppercase
- 日付セルが落ち着いた表示

スクロールバーが現れる画面でホバー時に黄グロー。

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "feat(design): Markdown/マニュアル/カレンダー/スクロールバーを Cyberpunk 化"
```

---

## Task 14: 期限切れ・本日期限ハイライト + アニメーション + reduced-motion 対応

**Files:**
- Modify: `app/globals.css` (期限ハイライトセクション + 末尾にアニメーション追加)

- [ ] **Step 1: 期限ハイライトセクションを置換**

現行末尾の「期限切れ / 本日期限ハイライト」セクションを以下に置き換える:

```css
/* =============================================================
   期限切れ / 本日期限ハイライト
   ============================================================= */

@keyframes overdue-pulse {
  0%,
  100% {
    border-color: var(--color-magenta);
    box-shadow: 0 0 0 rgba(255, 0, 60, 0);
  }
  50% {
    border-color: #ff5577;
    box-shadow: var(--shadow-glow-danger);
  }
}

.issue-card.is-overdue,
.today-item.is-overdue,
.kanban-card.is-overdue,
.local-task-item.is-overdue {
  background: linear-gradient(180deg, rgba(255, 0, 60, 0.12) 0%, var(--color-surface) 100%);
  border-color: var(--color-magenta);
  animation: overdue-pulse 1.2s ease-in-out infinite;
}

.issue-card.is-due-today,
.today-item.is-due-today,
.kanban-card.is-due-today,
.local-task-item.is-due-today {
  background: linear-gradient(180deg, rgba(252, 238, 10, 0.10) 0%, var(--color-surface) 100%);
  border-color: var(--color-accent);
}

.meta-due.is-overdue,
.kanban-card-due.is-overdue,
.local-task-due.is-overdue {
  color: var(--color-magenta);
  font-weight: 700;
  text-shadow: 0 0 6px rgba(255, 0, 60, 0.6);
}

.meta-due.is-due-today,
.kanban-card-due.is-due-today,
.local-task-due.is-due-today {
  color: var(--color-accent);
  font-weight: 700;
  text-shadow: 0 0 6px rgba(252, 238, 10, 0.6);
}

/* =============================================================
   アニメーション (reduced-motion 対応)
   ============================================================= */

@media (prefers-reduced-motion: reduce) {
  .brand-logo,
  .cyber-glitch {
    animation: none !important;
  }

  .issue-card.is-overdue,
  .today-item.is-overdue,
  .kanban-card.is-overdue,
  .local-task-item.is-overdue {
    animation: none !important;
  }

  body::before {
    /* スキャンラインは静的なら残す。動かないので OK */
  }

  * {
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: 動作確認**

http://localhost:3000 で期限切れチケットがあれば、それが赤い点滅枠で表示されることを確認。本日期限は黄ハイライトで点滅なし。

OS 設定で「視差効果を減らす」(macOS) または「アニメーションを表示する」をオフ (Windows) にして再読み込みし、点滅・グリッチが停止することを確認。

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "feat(design): 期限切れ点滅アニメーションと reduced-motion 対応を追加"
```

---

## Task 15: 全画面の最終目視確認

**Files:**
- なし (確認のみ)

- [ ] **Step 1: dev server で全画面を順次確認**

`npm run dev` 起動中の状態で以下を順に確認。コンソールエラー・崩れ・読みづらさをメモする。

| 画面 | URL | チェック項目 |
| --- | --- | --- |
| ダッシュボード | http://localhost:3000 | パネル左右、今日やる、メモタスク、カレンダー |
| チケット一覧 | http://localhost:3000/issues | フィルタ・ソート・カード・詳細パネル・編集モーダル開閉 |
| カンバン | http://localhost:3000/kanban | カラム・カード・ドラッグオーバー時のグロー・モード切替 |
| マニュアル | http://localhost:3000/manual | Markdown 表示・コードブロック・リンク |
| 設定 | http://localhost:3000/settings | 全セクション・env テーブル・カンバンマッピング |

- [ ] **Step 2: モーダル類の確認**

- ダッシュボードから「新規チケット作成」を試す → モーダルがクリップド + ハザード上端 + 赤クローズ
- チケットを選択 → 編集モーダル / 詳細パネルが Cyberpunk スタイル
- メモタスク追加・編集 → フォーム正常

- [ ] **Step 3: 期限ハイライトの確認**

期限切れ・本日期限のチケット/メモタスクがあれば、赤点滅・黄ハイライトが想定通りか確認。

- [ ] **Step 4: TypeScript と Lint チェック**

```bash
npm run typecheck
npm run lint
```
Expected: いずれも PASS

- [ ] **Step 5: テストスイート実行**

```bash
npm test
```
Expected: 既存のテストは全て PASS (このリニューアルは見た目変更のみで、ロジック変更なし)

- [ ] **Step 6: スクリーンショットで主要画面を保存 (任意)**

主要画面のスクリーンショットを `docs/superpowers/specs/2026-06-02-cyberpunk-design-screenshots/` に保存しておくと、後で見返せて便利 (任意)。

- [ ] **Step 7: コミット (確認だけのタスクなら不要)**

確認のみで変更がなければ commit 不要。修正があれば該当ファイルをコミット:

```bash
git commit -m "fix(design): Cyberpunk リニューアルの細部調整"
```

---

## 完了条件

すべての Task 1〜15 の Step が完了し、以下が満たされていること:

- [ ] `app/globals.css` が新トークン・新ユーティリティ・新コンポーネントスタイルに置き換わっている
- [ ] `app/layout.tsx` で Rajdhani / JetBrains Mono / Inter が `next/font/google` 経由で読み込まれている
- [ ] 全 5 画面 (ダッシュボード / チケット一覧 / カンバン / マニュアル / 設定) が Cyberpunk スタイルで表示される
- [ ] バッジ・期限切れ・本日期限の表示が新パレットで動作する
- [ ] `prefers-reduced-motion: reduce` でアニメーションが停止する
- [ ] 既存機能 (ドラッグ&ドロップ / モーダル開閉 / フォーム送信 / API 通信) が引き続き動作する
- [ ] `npm run typecheck` / `npm run lint` / `npm test` が PASS する
