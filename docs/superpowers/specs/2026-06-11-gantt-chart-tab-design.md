# ガントチャートタブ 設計ドキュメント

- 作成日: 2026-06-11
- 対象: Task Maestro にガントチャートタブを追加する
- ステータス: 設計確定（実装計画待ち）

## 1. 目的・背景

Backlog チケットとローカルタスクの「期限」を時間軸上で俯瞰し、
「次に何が来るか」「期限切れ（overdue）が何件あるか」を一目で把握できるビューを追加する。

既存のダッシュボード／カンバン／チケット一覧と並ぶ独立タブ（ページ）として提供する。

## 2. スコープ

### 含むもの
- ナビゲーションに「ガント」タブを追加（`/gantt`）。
- Backlog チケット（自分担当）とローカルタスクを行として表示。
- **過去 3 日 ＋ 今日 ＋ 14 日先 = 計 18 日・日単位** タイムライン（横軸）。今日は左から 4 列目。
- 「今日 〜 期限日」を帯（バー）として描画。overdue は「期限日 〜 今日」を赤帯で描く（過去 3 日分は実帯、それより古い超過は左端クリップ）。
- Backlog プロジェクトごとにグループ化。最後に「ローカルタスク」グループ。
- グループ内は期限日昇順。
- overdue（期限切れ）は「期限日 〜 今日」を赤帯で表示。
- 期限未設定タスクはタイムライン下部にリストで列挙。

### 含まないもの（YAGNI）
- ドラッグによる期間変更・編集。
- ズーム／粒度切替（週・月単位など）。
- Google カレンダー予定の重ね描画。
- 依存関係（タスク間の矢印）線。
- 開始日フィールドの新規追加（現データの `dueDate` のみで構成）。

## 3. データソースと制約

| ソース | 取得関数 | 日付フィールド | 備考 |
|---|---|---|---|
| Backlog チケット | `listLocalIssues()` | `dueDate` のみ（開始日なし） | `projectId` でグループ化、`issueKey` を表示 |
| ローカルタスク | `getLocalTasks`（未完了） | `dueDate` のみ | 単独グループ「ローカルタスク」 |

**重要な制約**: どちらのデータソースも開始日を持たない。
そのため帯は「今日 〜 期限日」を開始・終点として描画する（純粋に「期限までの残り」を可視化する帯）。

JST 基準の日付判定は既存 `lib/utils/date.ts`（`todayJst` / `isOverdueJst` / `daysOverdueJst` 等）を流用する。

## 4. アーキテクチャ

```
app/gantt/page.tsx  (Server Component, force-dynamic)
  ├─ listLocalIssues()      → 自分担当 Backlog チケット
  ├─ getAppSettings()       → projects[] (projectId → name/projectKey)
  └─ getLocalTasks(未完了)  → ローカルタスク
        │
        ▼  純粋関数で変換
  lib/services/ganttService.ts
    buildGanttRows(issues, localTasks, projects, today): GanttModel
        │
        ▼
  components/GanttChart.tsx (Client Component)
    → CSS Grid で 15 列タイムライン描画
```

- ナビ追加: `app/layout.tsx` の `<nav>` に `<Link href="/gantt">ガント</Link>` を追加。
- データ取得は既存 `app/issues/page.tsx` と同じパターンを踏襲。
- 日付・配置計算ロジックはすべて `ganttService.ts` の純粋関数に集約し、単体テスト可能にする。

## 5. データモデル

```ts
// タイムライン構成: 過去 3 日 + 今日 + 14 日先 = 18 日
const GANTT_PAST_DAYS = 3;
const GANTT_FUTURE_DAYS = 14;
const GANTT_DAYS = GANTT_PAST_DAYS + 1 + GANTT_FUTURE_DAYS; // 18
const TODAY_COL = GANTT_PAST_DAYS + 1;                       // 4（1 始まり）

type BarState = "normal" | "overdue" | "none";

interface GanttRow {
  id: string;            // "backlog-<id>" / "local-<id>"
  kind: "backlog" | "local";
  title: string;
  key?: string;          // Backlog issueKey（例: "PROJ-12"）
  dueDate?: string;      // YYYY-MM-DD（正規化済み）
  barState: BarState;
  // CSS Grid 配置（1 始まり、列番号）。barState === "none" の行では未使用。
  startCol: number;      // grid-column 開始（1..GANTT_DAYS）
  span: number;          // 列スパン（>=1）
  clipLeft: boolean;     // 帯が範囲外（過去側）から始まる（◂ マーカー）
  clipRight: boolean;    // 期限が範囲外（未来側）へ続く（▸ マーカー）
}

interface GanttGroup {
  groupName: string;     // プロジェクト名 or "ローカルタスク"
  rows: GanttRow[];      // 期限日昇順
}

interface GanttModel {
  days: string[];        // 横軸ラベル用 YYYY-MM-DD ×15
  groups: GanttGroup[];  // バー有りの行（プロジェクト群 → ローカル）
  undated: GanttRow[];   // 期限未設定の行（下部リスト用）
}
```

## 6. 帯（バー）配置ロジック

横軸は `today - 3日`（列 1）〜 `today + 14日`（列 18）。今日は列 4（`TODAY_COL`）。
列番号は `colOf(date) = (date - (today - 3日)) + 1` で求める（範囲外は 1 または 18 にクランプ）。

- **通常（今日 <= 期限 <= 今日+14）**: `startCol = TODAY_COL`、`span = colOf(期限) - TODAY_COL + 1`。期限当日も 1 セル含む。
- **期限 = 今日**: `startCol = TODAY_COL`、`span = 1`。
- **期限 > 今日+14**: `startCol = TODAY_COL`、終端を列 18 にクランプ、`clipRight = true`（▸）。
- **overdue（期限 < 今日）**: 帯は「期限 〜 今日」。`barState = "overdue"`。
  - 期限が過去 3 日以内（列 1〜3）: `startCol = colOf(期限)`、`span = TODAY_COL - startCol + 1`。実際の超過区間を赤帯で描く。
  - 期限が 3 日より古い（列 1 未満）: `startCol = 1` にクランプ、`span = TODAY_COL`、`clipLeft = true`（◂）。
  - `daysOverdueJst` で超過日数を算出し、ツールチップ／ラベルに「N日超過」を表示。
- **期限なし**: `barState = "none"` として `undated` に振り分け。

> 設計判断: overdue の赤帯を「期限 〜 今日」で本当に描くため、横軸に過去 3 日分の余白を設けた。
> 3 日より古い超過は左端でクリップ（◂）し、超過日数ラベルで遅延の重さを補う。

## 7. UI / スタイル

```
┌─ ガントチャート ──────────────────────────────────────────┐
│         6/8 6/9 6/10 │6/11│ 6/12 ... 6/25  ← 横軸(18日,日単位)    │
│                       [今日=列4]                                  │
├──────────────────┼──────────────────────────────────────┤
│ ▸ PROJECT_A                                                      │
│   PROJ-12 設計書作成 │       ▓▓▓▓▓▓▓ (今日〜期限, イエロー帯)         │
│   PROJ-15 レビュー   │ ▓▓▓▓ (overdue 期限〜今日, マゼンタ赤帯 N日超過) │
│   PROJ-09 旧タスク   │◂▓▓▓▓ (3日より古い超過, 左端クリップ)          │
│ ▸ ローカルタスク                                                  │
│   メモ書き           │      ▓▓▓▓                                  │
├──────────────────┴──────────────────────────────────────┤
│ ⚠ 期限未設定: PROJ-30 / ローカル「あれ」 …（帯なしリスト）           │
└──────────────────────────────────────────────────────────┘
```

- **左ペイン（固定幅）**: グループ見出し ＋ タスク名（Backlog はキー併記）。
- **右ペイン（タイムライン）**: `grid-template-columns: repeat(18, 1fr)`。各バーは `grid-column: startCol / span span`。
- **横軸ヘッダー**: 日付（M/D）。今日列（列 4）をハイライト（縦ライン ＋ `--color-accent`）。過去 3 列はトーンを落とす。土日もトーンを落とす。
- **帯色（既存テーマトークン）**:
  - 通常（今日〜期限）= `--color-accent`（イエロー）
  - overdue = `--color-magenta` / `--color-danger`（赤）
- **クリップマーカー**: 範囲外へ続く場合 `▸`、過去から来る場合 `◂`。
- **期限未設定**: タイムライン下部に折りたたみ可能なリスト。
- **空状態**: 該当 0 件のときメッセージ表示。
- スタイルは `app/globals.css` に既存のサイバーテーマ流儀で追記（コンポーネント独自 CSS は持たせない既存方針に合わせる）。

## 8. 端ケース

| ケース | 扱い |
|---|---|
| 期限 = 今日 | 今日列（列 4）に 1 セル帯（イエロー） |
| 期限 > 今日+14 | 帯を列 18 でクリップ、`▸` マーカー |
| overdue（過去 3 日以内） | 期限〜今日の赤帯（実区間）＋「N日超過」ラベル |
| overdue（3 日より古い） | 列 1 にクランプした赤帯 ＋ `◂` ＋「N日超過」ラベル |
| 期限なし | `undated` リストへ |
| プロジェクト名未解決 | `projectKey` → 無ければ「プロジェクト #<id>」でフォールバック |
| 該当タスク 0 件 | 空状態メッセージ |
| 完了済みローカルタスク | 既定で除外（未完了のみ表示） |

## 9. テスト方針

vitest（既存 `vitest.config.ts`）を踏襲。ロジックを `ganttService.ts` に寄せ、純粋関数を集中テストする。

`tests/ganttService.test.ts` のケース:
- 通常帯の `startCol` / `span` 計算（期限 = 今日 / 今日+5 / 今日+14）。すべて `startCol = TODAY_COL`（=4）。
- 期限 > 今日+14 のクリップ（終端を列 18 にクランプ, `clipRight = true`）。
- overdue（過去 3 日以内）の実区間赤帯（`barState = "overdue"`, `clipLeft = false`, 超過日数）。
- overdue（3 日より古い）の左端クランプ（`startCol = 1`, `clipLeft = true`, 超過日数）。
- 期限なしの `undated` 振り分け。
- プロジェクトグルーピング順（プロジェクト群 → ローカル）＆グループ内期限昇順。
- プロジェクト名フォールバック（settings 未登録）。
- 完了済みローカルタスクの除外。
- JST 境界（`todayJst` 基準で日付が変わるケース）。

コンポーネント `GanttChart.tsx` は表示中心のため、まず service のテストで品質を担保する。

## 10. 影響範囲

- 新規: `app/gantt/page.tsx`, `components/GanttChart.tsx`, `lib/services/ganttService.ts`, `lib/types/gantt.ts`, `tests/ganttService.test.ts`。
- 変更: `app/layout.tsx`（ナビにリンク追加）、`app/globals.css`（ガント用スタイル追記）。
- 既存サービス／DB スキーマへの変更なし（読み取りのみ）。
