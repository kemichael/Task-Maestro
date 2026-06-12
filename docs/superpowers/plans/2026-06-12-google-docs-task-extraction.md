# Google ドキュメントからのタスク抽出 Implementation Plan (FR-007 + FR-002)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 任意の Google ドキュメントおよび Meet 議事録を取り込み、AI 抽出で Backlog チケット候補を生成して既存導線でチケット化できるようにする。

**Architecture:** AI 抽出エンジン (OpenAI / Claude Code CLI 切替) を中核に置き、FR-007 (手動 Docs URL) と FR-002 (議事録自動紐付け) の 2 経路が同じエンジンを共用する。取得・抽出・チケット化の 3 層で構成。

**Tech Stack:** TypeScript / Next.js 15 (App Router) / better-sqlite3 / zod / googleapis / vitest

参照: `docs/superpowers/specs/2026-06-12-google-docs-task-extraction-design.md`

---

## ファイル構成

### Phase 1: AI 抽出エンジン (共用)
- Create: `lib/types/ai.ts` — `ExtractionInput` / `AIProvider`
- Create: `lib/validation/extractionSchema.ts` — AI 出力検証 zod スキーマ
- Create: `lib/services/ai/buildExtractionPrompt.ts` — プロンプト整形 (純粋関数)
- Create: `lib/services/ai/parseCandidates.ts` — 生文字列 → `TicketCandidate[]` (純粋関数)
- Create: `lib/services/ai/openaiProvider.ts` — OpenAI REST (`fetch`)
- Create: `lib/services/ai/claudeCodeProvider.ts` — Claude Code CLI (`child_process`)
- Create: `lib/services/ai/index.ts` — `getProvider`
- Create: `lib/services/aiExtractionService.ts` — オーケストレーション

### Phase 2: Google Docs 取り込み + FR-007
- Create: `lib/utils/googleDocsUrl.ts` — URL → documentId (純粋関数)
- Create: `lib/clients/googleDocs.ts` — `getDocumentText`
- Create: `app/api/documents/fetch/route.ts`
- Create: `app/api/documents/extract/route.ts`
- Create: `app/documents/page.tsx`
- Create: `components/DocumentExtractPane.tsx`
- Modify: `app/layout.tsx` — ナビ追加 (Phase 3 と合わせて 1 回)

### Phase 3: FR-002 議事録自動紐付け
- Create: `migrations/0006_add_meeting_doc.sql`
- Create: `lib/types/meetingRow.ts` — DB 行型
- Create: `lib/db/meetingDocRepository.ts`
- Modify: `lib/types/calendar.ts` — `attachments` / `attended` 追加
- Modify: `lib/clients/googleCalendar.ts` — attachments / attendees 取得
- Create: `lib/clients/googleDrive.ts` — `searchDocs`
- Create: `lib/services/meeting/linkMeetingDoc.ts` — 紐付け純粋関数
- Create: `lib/services/meetingService.ts` — オーケストレーション
- Create: `app/api/meetings/route.ts`
- Create: `app/api/meetings/[id]/extract/route.ts`
- Create: `app/api/meetings/[id]/route.ts`
- Create: `app/meetings/page.tsx`
- Create: `components/MeetingExtractPane.tsx`

---

## Phase 0: 前提 — OAuth スコープ

### Task 0: Docs/Drive スコープ追加手順をマニュアルに追記

**Files:**
- Modify: `app/manual/manual.md`

- [ ] **Step 1: マニュアルに認証手順を追記**

`app/manual/manual.md` の認証情報セクションへ以下を追記する (見出しレベルは周辺に合わせる)。

```markdown
### Google Docs / 議事録抽出を使う場合の追加スコープ

タスク抽出機能は Google Docs API と Drive API を利用する。`GOOGLE_REFRESH_TOKEN`
を以下のスコープを含めて再発行すること。

- `https://www.googleapis.com/auth/calendar` (既存)
- `https://www.googleapis.com/auth/documents.readonly` (追加: 議事録/ドキュメント本文の読み取り)
- `https://www.googleapis.com/auth/drive.readonly` (追加: 議事録 Docs の検索)

スコープが不足している場合、抽出時に 403 エラーとなり「Google の認証に失敗」と表示される。
その場合は上記スコープを含めて再認証し、`.env` の `GOOGLE_REFRESH_TOKEN` を更新する。
```

- [ ] **Step 2: Commit**

```bash
git add app/manual/manual.md
git commit -m "docs: Docs/Drive スコープ追加手順をマニュアルに追記"
```

---

## Phase 1: AI 抽出エンジン

### Task 1: AI 型定義と出力検証スキーマ

**Files:**
- Create: `lib/types/ai.ts`
- Create: `lib/validation/extractionSchema.ts`
- Test: `tests/lib/extractionSchema.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/lib/extractionSchema.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { extractionResultSchema, normalizeCandidates } from "@/lib/validation/extractionSchema";

describe("extractionResultSchema", () => {
  it("配列形式を受理する", () => {
    const parsed = extractionResultSchema.parse([{ title: "やること" }]);
    expect(normalizeCandidates(parsed)).toEqual([{ title: "やること" }]);
  });

  it("{candidates:[...]} 形式を受理する", () => {
    const parsed = extractionResultSchema.parse({ candidates: [{ title: "A", body: "詳細" }] });
    expect(normalizeCandidates(parsed)).toEqual([{ title: "A", body: "詳細" }]);
  });

  it("title 欠損は弾く", () => {
    expect(() => extractionResultSchema.parse([{ body: "x" }])).toThrow();
  });

  it("suggested_due は YYYY-MM-DD 以外を弾く", () => {
    expect(() => extractionResultSchema.parse([{ title: "A", suggested_due: "2026/01/01" }])).toThrow();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- extractionSchema`
Expected: FAIL ("Cannot find module '@/lib/validation/extractionSchema'")

- [ ] **Step 3: 型定義を実装**

`lib/types/ai.ts`:

```typescript
import type { TicketCandidate, TicketSourceMeta } from "./ticket";

export interface ExtractionInput {
  /** 抽出元の本文 (Docs 本文 / 議事録テキスト) */
  text: string;
  /** チケットに残すソース情報 (kind: "document" | "meeting", ref: URL) */
  sourceMeta: TicketSourceMeta;
  /** FR-002 の発話者・割当先識別用 (利用者名)。任意 */
  selfName?: string;
}

export interface AIProvider {
  extractCandidates(input: ExtractionInput): Promise<TicketCandidate[]>;
}
```

- [ ] **Step 4: 検証スキーマを実装**

`lib/validation/extractionSchema.ts`:

```typescript
import { z } from "zod";
import type { TicketCandidate } from "../types/ticket";

export const ticketCandidateSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  suggested_due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const extractionResultSchema = z.union([
  z.array(ticketCandidateSchema),
  z.object({ candidates: z.array(ticketCandidateSchema) }),
]);

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/** union の両形式を `TicketCandidate[]` に正規化する */
export function normalizeCandidates(result: ExtractionResult): TicketCandidate[] {
  return Array.isArray(result) ? result : result.candidates;
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm test -- extractionSchema`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/types/ai.ts lib/validation/extractionSchema.ts tests/lib/extractionSchema.test.ts
git commit -m "feat: AI 抽出の型定義と出力検証スキーマを追加"
```

---

### Task 2: 抽出プロンプト整形 (純粋関数)

**Files:**
- Create: `lib/services/ai/buildExtractionPrompt.ts`
- Test: `tests/lib/buildExtractionPrompt.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/lib/buildExtractionPrompt.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildExtractionPrompt } from "@/lib/services/ai/buildExtractionPrompt";

describe("buildExtractionPrompt", () => {
  const base = { text: "明日までに資料を作る", sourceMeta: { kind: "document" as const, ref: "https://x" } };

  it("本文をプロンプトに含める", () => {
    expect(buildExtractionPrompt(base)).toContain("明日までに資料を作る");
  });

  it("JSON 形式での出力を指示する", () => {
    expect(buildExtractionPrompt(base)).toMatch(/JSON/);
  });

  it("selfName があれば本人のネクストアクションに絞る指示を含める", () => {
    const p = buildExtractionPrompt({ ...base, selfName: "山田" });
    expect(p).toContain("山田");
  });

  it("selfName が無ければ本人指定の文言を含めない", () => {
    expect(buildExtractionPrompt(base)).not.toContain("発話者");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- buildExtractionPrompt`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: 実装**

`lib/services/ai/buildExtractionPrompt.ts`:

```typescript
import type { ExtractionInput } from "../../types/ai";

/**
 * AI に渡す抽出プロンプトを組み立てる純粋関数。
 * 出力は必ず JSON 配列 (title / body / suggested_due) を要求する。
 */
export function buildExtractionPrompt(input: ExtractionInput): string {
  const selfLine = input.selfName
    ? `この議事録における発話者「${input.selfName}」本人のネクストアクションのみを対象にすること。\n`
    : "";
  return [
    "あなたはタスク抽出アシスタントです。以下の文章から実行すべきタスクを抽出してください。",
    selfLine,
    "出力は次の JSON 配列のみとし、前後に説明文やコードフェンスを付けないこと:",
    '[{"title": "タスク名", "body": "補足(任意)", "suggested_due": "YYYY-MM-DD(任意)"}]',
    "タスクが無ければ空配列 [] を返すこと。title は簡潔な日本語にすること。",
    "--- 本文ここから ---",
    input.text,
    "--- 本文ここまで ---",
  ].join("\n");
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- buildExtractionPrompt`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/buildExtractionPrompt.ts tests/lib/buildExtractionPrompt.test.ts
git commit -m "feat: 抽出プロンプト整形関数を追加"
```

---

### Task 3: 候補パース (純粋関数)

**Files:**
- Create: `lib/services/ai/parseCandidates.ts`
- Test: `tests/lib/parseCandidates.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/lib/parseCandidates.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseCandidates } from "@/lib/services/ai/parseCandidates";
import { AiProviderError } from "@/lib/errors";

describe("parseCandidates", () => {
  it("素の JSON 配列をパースする", () => {
    expect(parseCandidates('[{"title":"A"}]')).toEqual([{ title: "A" }]);
  });

  it("コードフェンス付きを許容する", () => {
    const raw = "```json\n[{\"title\":\"A\"}]\n```";
    expect(parseCandidates(raw)).toEqual([{ title: "A" }]);
  });

  it("{candidates:[...]} 形式も許容する", () => {
    expect(parseCandidates('{"candidates":[{"title":"B"}]}')).toEqual([{ title: "B" }]);
  });

  it("不正 JSON は AiProviderError を投げる", () => {
    expect(() => parseCandidates("これは JSON ではない")).toThrow(AiProviderError);
  });

  it("スキーマ違反は AiProviderError を投げる", () => {
    expect(() => parseCandidates('[{"body":"title なし"}]')).toThrow(AiProviderError);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- parseCandidates`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: 実装**

`lib/services/ai/parseCandidates.ts`:

```typescript
import type { TicketCandidate } from "../../types/ticket";
import { extractionResultSchema, normalizeCandidates } from "../../validation/extractionSchema";
import { AiProviderError } from "../../errors";

/** ```json ... ``` フェンスや前後の余分なテキストを除去して JSON 本体を取り出す */
function stripFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  return start >= 0 && end >= start ? body.slice(start, end + 1) : body;
}

/** AI の生出力文字列を検証済み `TicketCandidate[]` に変換する純粋関数 */
export function parseCandidates(raw: string): TicketCandidate[] {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch (error) {
    throw new AiProviderError("AI 出力が JSON として解釈できませんでした", error);
  }
  const result = extractionResultSchema.safeParse(json);
  if (!result.success) {
    throw new AiProviderError("AI 出力が期待する形式ではありません", result.error);
  }
  return normalizeCandidates(result.data);
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- parseCandidates`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/parseCandidates.ts tests/lib/parseCandidates.test.ts
git commit -m "feat: AI 出力の候補パース関数を追加"
```

---

### Task 4: OpenAI プロバイダ

**Files:**
- Create: `lib/services/ai/openaiProvider.ts`
- Test: `tests/services/openaiProvider.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/services/openaiProvider.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ OPENAI_API_KEY: "sk-test" }),
}));

import { createOpenAiProvider } from "@/lib/services/ai/openaiProvider";

afterEach(() => vi.restoreAllMocks());

function mockFetchOnce(content: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    }),
  );
}

describe("openaiProvider", () => {
  const input = { text: "資料を作る", sourceMeta: { kind: "document" as const, ref: "x" } };

  it("レスポンスから候補を抽出する", async () => {
    mockFetchOnce('[{"title":"資料作成"}]');
    const provider = createOpenAiProvider("gpt-4o-mini");
    await expect(provider.extractCandidates(input)).resolves.toEqual([{ title: "資料作成" }]);
  });

  it("HTTP エラー時は AiProviderError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }));
    const provider = createOpenAiProvider("gpt-4o-mini");
    await expect(provider.extractCandidates(input)).rejects.toThrow(/OpenAI/);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- openaiProvider`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: 実装**

`lib/services/ai/openaiProvider.ts`:

```typescript
import "server-only";
import type { AIProvider, ExtractionInput } from "../../types/ai";
import type { TicketCandidate } from "../../types/ticket";
import { getEnv } from "../../env";
import { AiProviderError } from "../../errors";
import { buildExtractionPrompt } from "./buildExtractionPrompt";
import { parseCandidates } from "./parseCandidates";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export function createOpenAiProvider(model: string): AIProvider {
  return {
    async extractCandidates(input: ExtractionInput): Promise<TicketCandidate[]> {
      const apiKey = getEnv().OPENAI_API_KEY;
      if (!apiKey) {
        throw new AiProviderError("OPENAI_API_KEY が未設定です。設定画面で別プロバイダへ切替えるか API キーを設定してください");
      }
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: buildExtractionPrompt(input) }],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new AiProviderError(`OpenAI API エラー (${res.status}): ${detail.slice(0, 200)}`);
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? "";
      return parseCandidates(content);
    },
  };
}
```

> 補足: `response_format: json_object` を使うため、プロンプトは `{candidates:[...]}` も `[...]` も許容する `parseCandidates` が吸収する。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- openaiProvider`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/openaiProvider.ts tests/services/openaiProvider.test.ts
git commit -m "feat: OpenAI 抽出プロバイダを追加"
```

---

### Task 5: Claude Code CLI プロバイダ

**Files:**
- Create: `lib/services/ai/claudeCodeProvider.ts`
- Test: `tests/services/claudeCodeProvider.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/services/claudeCodeProvider.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({ execFile: (...args: unknown[]) => execFileMock(...args) }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ CLAUDE_CODE_PATH: "/usr/bin/claude" }) }));

import { createClaudeCodeProvider } from "@/lib/services/ai/claudeCodeProvider";

afterEach(() => vi.restoreAllMocks());

// execFile(file, args, cb) の最後の引数 cb に (err, stdout, stderr) を渡す形をエミュレート
function mockExec(stdout: string, err: Error | null = null) {
  execFileMock.mockImplementation((_file, _args, cb: (e: Error | null, o: string, s: string) => void) => {
    cb(err, stdout, "");
  });
}

describe("claudeCodeProvider", () => {
  const input = { text: "資料を作る", sourceMeta: { kind: "document" as const, ref: "x" } };

  it("CLI 出力から候補を抽出する", async () => {
    mockExec('[{"title":"資料作成"}]');
    const provider = createClaudeCodeProvider();
    await expect(provider.extractCandidates(input)).resolves.toEqual([{ title: "資料作成" }]);
  });

  it("CLI 実行エラー時は AiProviderError", async () => {
    mockExec("", new Error("spawn failed"));
    const provider = createClaudeCodeProvider();
    await expect(provider.extractCandidates(input)).rejects.toThrow(/Claude Code/);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- claudeCodeProvider`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: 実装**

`lib/services/ai/claudeCodeProvider.ts`:

```typescript
import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AIProvider, ExtractionInput } from "../../types/ai";
import type { TicketCandidate } from "../../types/ticket";
import { getEnv } from "../../env";
import { AiProviderError } from "../../errors";
import { buildExtractionPrompt } from "./buildExtractionPrompt";
import { parseCandidates } from "./parseCandidates";

const execFileAsync = promisify(execFile);

export function createClaudeCodeProvider(): AIProvider {
  return {
    async extractCandidates(input: ExtractionInput): Promise<TicketCandidate[]> {
      const claudePath = getEnv().CLAUDE_CODE_PATH;
      if (!claudePath) {
        throw new AiProviderError("CLAUDE_CODE_PATH が未設定です。設定画面で別プロバイダへ切替えるか CLI パスを設定してください");
      }
      const prompt = buildExtractionPrompt(input);
      try {
        const { stdout } = await execFileAsync(
          claudePath,
          ["-p", prompt],
          { maxBuffer: 10 * 1024 * 1024, timeout: 120_000 },
        );
        return parseCandidates(stdout);
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        throw new AiProviderError("Claude Code CLI の実行に失敗しました", error);
      }
    },
  };
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- claudeCodeProvider`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/ai/claudeCodeProvider.ts tests/services/claudeCodeProvider.test.ts
git commit -m "feat: Claude Code CLI 抽出プロバイダを追加"
```

---

### Task 6: プロバイダ解決と抽出サービス

**Files:**
- Create: `lib/services/ai/index.ts`
- Create: `lib/services/aiExtractionService.ts`
- Test: `tests/services/aiExtractionService.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/services/aiExtractionService.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

const extractMock = vi.fn();
vi.mock("@/lib/services/ai/index", () => ({
  getProvider: () => ({ extractCandidates: extractMock }),
}));
vi.mock("@/lib/db/settingsRepository", () => ({
  getAppSettings: () => ({ ai: { provider: "openai", openaiModel: "gpt-4o-mini" } }),
}));

import { extractCandidatesFromText } from "@/lib/services/aiExtractionService";

afterEach(() => vi.restoreAllMocks());

describe("extractCandidatesFromText", () => {
  it("設定のプロバイダで候補を抽出する", async () => {
    extractMock.mockResolvedValue([{ title: "X" }]);
    const result = await extractCandidatesFromText({
      text: "本文",
      sourceMeta: { kind: "document", ref: "https://x" },
    });
    expect(result).toEqual([{ title: "X" }]);
    expect(extractMock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- aiExtractionService`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: getProvider を実装**

`lib/services/ai/index.ts`:

```typescript
import "server-only";
import type { AIProvider } from "../../types/ai";
import type { AIProviderKind } from "../../types/settings";
import { createOpenAiProvider } from "./openaiProvider";
import { createClaudeCodeProvider } from "./claudeCodeProvider";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getProvider(kind: AIProviderKind, openaiModel?: string): AIProvider {
  if (kind === "claudeCode") return createClaudeCodeProvider();
  return createOpenAiProvider(openaiModel ?? DEFAULT_OPENAI_MODEL);
}
```

- [ ] **Step 4: 抽出サービスを実装**

`lib/services/aiExtractionService.ts`:

```typescript
import "server-only";
import type { ExtractionInput } from "../types/ai";
import type { TicketCandidate } from "../types/ticket";
import { getAppSettings } from "../db/settingsRepository";
import { getProvider } from "./ai/index";

/** 設定で選択された AI プロバイダを用いて本文からチケット候補を抽出する */
export async function extractCandidatesFromText(input: ExtractionInput): Promise<TicketCandidate[]> {
  const { provider, openaiModel } = getAppSettings().ai;
  return getProvider(provider, openaiModel).extractCandidates(input);
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm test -- aiExtractionService`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/services/ai/index.ts lib/services/aiExtractionService.ts tests/services/aiExtractionService.test.ts
git commit -m "feat: AI プロバイダ解決と抽出サービスを追加"
```

---

## Phase 2: Google Docs 取り込み + FR-007

### Task 7: Google Docs URL パース (純粋関数)

**Files:**
- Create: `lib/utils/googleDocsUrl.ts`
- Test: `tests/lib/googleDocsUrl.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/lib/googleDocsUrl.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { extractDocumentId } from "@/lib/utils/googleDocsUrl";

describe("extractDocumentId", () => {
  it("標準的な /document/d/<id>/edit を抽出する", () => {
    expect(extractDocumentId("https://docs.google.com/document/d/abc123_-XYZ/edit")).toBe("abc123_-XYZ");
  });

  it("末尾スラッシュ無しも抽出する", () => {
    expect(extractDocumentId("https://docs.google.com/document/d/ABC")).toBe("ABC");
  });

  it("?usp=sharing 付きも抽出する", () => {
    expect(extractDocumentId("https://docs.google.com/document/d/ID999/edit?usp=sharing")).toBe("ID999");
  });

  it("素の ID 文字列も受理する", () => {
    expect(extractDocumentId("abc123_-XYZ")).toBe("abc123_-XYZ");
  });

  it("不正な URL は null を返す", () => {
    expect(extractDocumentId("https://example.com/foo")).toBeNull();
    expect(extractDocumentId("")).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- googleDocsUrl`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: 実装**

`lib/utils/googleDocsUrl.ts`:

```typescript
/**
 * Google Docs の URL または素の ID から documentId を抽出する純粋関数。
 * 抽出できない場合は null を返す。
 */
export function extractDocumentId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  // 素の ID (英数・_- のみで構成) はそのまま受理
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- googleDocsUrl`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils/googleDocsUrl.ts tests/lib/googleDocsUrl.test.ts
git commit -m "feat: Google Docs URL から documentId 抽出関数を追加"
```

---

### Task 8: Google Docs クライアント

**Files:**
- Create: `lib/clients/googleDocs.ts`
- Test: `tests/clients/googleDocs.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (本文フラット化の純粋関数を検証)

`tests/clients/googleDocs.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { flattenDocumentText } from "@/lib/clients/googleDocs";

describe("flattenDocumentText", () => {
  it("段落の textRun を連結する", () => {
    const doc = {
      body: {
        content: [
          { paragraph: { elements: [{ textRun: { content: "一行目\n" } }] } },
          { paragraph: { elements: [{ textRun: { content: "二行目\n" } }] } },
        ],
      },
    };
    expect(flattenDocumentText(doc)).toBe("一行目\n二行目\n");
  });

  it("textRun を持たない要素は無視する", () => {
    const doc = { body: { content: [{ tableOfContents: {} }, { paragraph: { elements: [{ textRun: { content: "本文" } }] } }] } };
    expect(flattenDocumentText(doc)).toBe("本文");
  });

  it("body が無ければ空文字", () => {
    expect(flattenDocumentText({})).toBe("");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- googleDocs`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: 実装**

`lib/clients/googleDocs.ts`:

```typescript
import "server-only";
import { google } from "googleapis";
import { getOAuth2Client } from "./googleAuth";
import { ExternalApiError } from "../errors";
import { logger } from "../logger";

interface DocElement {
  textRun?: { content?: string | null };
}
interface DocStructural {
  paragraph?: { elements?: DocElement[] };
}
interface DocLike {
  body?: { content?: DocStructural[] };
}

/** Docs API の document レスポンスをプレーンテキストに変換する純粋関数 */
export function flattenDocumentText(doc: DocLike): string {
  const content = doc.body?.content ?? [];
  let out = "";
  for (const block of content) {
    const elements = block.paragraph?.elements ?? [];
    for (const el of elements) {
      out += el.textRun?.content ?? "";
    }
  }
  return out;
}

/** documentId から本文プレーンテキストを取得する */
export async function getDocumentText(documentId: string): Promise<string> {
  try {
    const docs = google.docs({ version: "v1", auth: getOAuth2Client() });
    const res = await docs.documents.get({ documentId });
    return flattenDocumentText(res.data as DocLike);
  } catch (error) {
    const e = error as { code?: number; message?: string };
    logger.warn({ op: "getDocumentText", code: e.code }, "Google Docs API エラー");
    if (e.code === 401 || e.code === 403) {
      throw new ExternalApiError(
        "Google Docs の認証に失敗しました (Docs/Drive スコープ不足の可能性)。マニュアルの追加スコープ手順を確認してください",
        "auth",
        false,
        e.code,
        error,
      );
    }
    if (e.code === 404) {
      throw new ExternalApiError("指定された Google ドキュメントが見つかりません", "notFound", false, 404, error);
    }
    throw new ExternalApiError(`Google Docs API エラー: ${e.message ?? ""}`, "unknown", false, e.code, error);
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- googleDocs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/clients/googleDocs.ts tests/clients/googleDocs.test.ts
git commit -m "feat: Google Docs 本文取得クライアントを追加"
```

---

### Task 9: ドキュメント本文取得 API

**Files:**
- Create: `app/api/documents/fetch/route.ts`

- [ ] **Step 1: 実装**

`app/api/documents/fetch/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { extractDocumentId } from "@/lib/utils/googleDocsUrl";
import { getDocumentText } from "@/lib/clients/googleDocs";
import { errorResponse, ok } from "@/lib/http/response";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({ docUrl: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { docUrl } = bodySchema.parse(await req.json());
    const documentId = extractDocumentId(docUrl);
    if (!documentId) {
      throw new ValidationError("有効な Google ドキュメントの URL ではありません");
    }
    const text = await getDocumentText(documentId);
    return ok({ documentId, text });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add app/api/documents/fetch/route.ts
git commit -m "feat: ドキュメント本文取得 API を追加"
```

---

### Task 10: 抽出 API

**Files:**
- Create: `app/api/documents/extract/route.ts`

- [ ] **Step 1: 実装**

`app/api/documents/extract/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { extractCandidatesFromText } from "@/lib/services/aiExtractionService";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1),
  sourceRef: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { text, sourceRef } = bodySchema.parse(await req.json());
    const candidates = await extractCandidatesFromText({
      text,
      sourceMeta: { kind: "document", ref: sourceRef },
    });
    return ok({ candidates });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add app/api/documents/extract/route.ts
git commit -m "feat: ドキュメント抽出 API を追加"
```

---

### Task 11: FR-007 ドキュメント抽出 UI

**Files:**
- Create: `app/documents/page.tsx`
- Create: `components/DocumentExtractPane.tsx`

> 注: チケット化導線は既存 `POST /api/backlog/issues` を候補ごとに呼ぶ。プロジェクト選択は
> `GET /api/backlog/projects` 等の既存導線がある場合はそれに合わせる。本タスクでは
> プロジェクト ID を数値入力で受ける最小実装とし、既存のプロジェクト選択 UI があれば後続で差し替える。

- [ ] **Step 1: ページシェルを実装**

`app/documents/page.tsx`:

```tsx
import DocumentExtractPane from "@/components/DocumentExtractPane";

export const metadata = { title: "ドキュメント抽出 | Task Maestro" };

export default function DocumentsPage() {
  return (
    <section className="page">
      <h1>ドキュメントからタスク抽出</h1>
      <p className="page-desc">Google ドキュメントの URL を入力し、本文を確認してから AI でタスク候補を抽出します。</p>
      <DocumentExtractPane />
    </section>
  );
}
```

- [ ] **Step 2: 抽出ペインを実装**

`components/DocumentExtractPane.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { TicketCandidate } from "@/lib/types/ticket";

type Phase = "input" | "preview" | "candidates";

interface EditableCandidate extends TicketCandidate {
  selected: boolean;
  projectId: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "リクエストに失敗しました");
  return data as T;
}

export default function DocumentExtractPane() {
  const [phase, setPhase] = useState<Phase>("input");
  const [docUrl, setDocUrl] = useState("");
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ text: string }>("/api/documents/fetch", { docUrl });
      setText(data.text);
      setPhase("preview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExtract() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ candidates: TicketCandidate[] }>("/api/documents/extract", {
        text,
        sourceRef: docUrl,
      });
      setCandidates(data.candidates.map((c) => ({ ...c, selected: true, projectId: "" })));
      setPhase("candidates");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updateCandidate(idx: number, patch: Partial<EditableCandidate>) {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  async function handleCreateTickets() {
    setBusy(true);
    setError(null);
    try {
      const targets = candidates.filter((c) => c.selected && c.projectId);
      for (const c of targets) {
        await postJson("/api/backlog/issues", {
          projectId: Number(c.projectId),
          summary: c.title,
          description: c.body ? `${c.body}\n\n${docUrl}` : docUrl,
          dueDate: c.suggested_due,
          sourceMeta: { kind: "document", ref: docUrl },
        });
      }
      setError(`${targets.length} 件のチケットを作成しました`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="extract-pane">
      {error && <p className="extract-error" role="alert">{error}</p>}

      {phase === "input" && (
        <div className="extract-input">
          <input
            type="url"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/..."
            aria-label="Google ドキュメント URL"
          />
          <button onClick={handleFetch} disabled={busy || !docUrl}>本文を取得</button>
        </div>
      )}

      {phase === "preview" && (
        <div className="extract-preview">
          <p>以下の本文を AI に送信します。内容を確認してください。</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          <div className="extract-actions">
            <button onClick={() => setPhase("input")} disabled={busy}>戻る</button>
            <button onClick={handleExtract} disabled={busy || !text}>AI 抽出を実行</button>
          </div>
        </div>
      )}

      {phase === "candidates" && (
        <div className="extract-candidates">
          {candidates.length === 0 && <p>抽出されたタスクはありませんでした。</p>}
          {candidates.map((c, i) => (
            <div key={i} className="candidate-row">
              <input
                type="checkbox"
                checked={c.selected}
                onChange={(e) => updateCandidate(i, { selected: e.target.checked })}
                aria-label="チケット化対象"
              />
              <input value={c.title} onChange={(e) => updateCandidate(i, { title: e.target.value })} aria-label="タイトル" />
              <input
                value={c.projectId}
                onChange={(e) => updateCandidate(i, { projectId: e.target.value })}
                placeholder="プロジェクト ID"
                aria-label="プロジェクト ID"
              />
              <input
                value={c.suggested_due ?? ""}
                onChange={(e) => updateCandidate(i, { suggested_due: e.target.value || undefined })}
                placeholder="YYYY-MM-DD"
                aria-label="期限"
              />
            </div>
          ))}
          <div className="extract-actions">
            <button onClick={() => setPhase("preview")} disabled={busy}>戻る</button>
            <button onClick={handleCreateTickets} disabled={busy}>選択をチケット化</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 4: 動作確認 (任意・手動)**

Run: `npm run dev` → `/documents` で URL 入力 → 本文取得 → 抽出 → チケット化 を確認

- [ ] **Step 5: Commit**

```bash
git add app/documents/page.tsx components/DocumentExtractPane.tsx
git commit -m "feat: ドキュメント抽出ページと抽出ペインを追加"
```

---

## Phase 3: FR-002 議事録自動紐付け

### Task 12: meeting_doc マイグレーションとリポジトリ

**Files:**
- Create: `migrations/0006_add_meeting_doc.sql`
- Create: `lib/types/meetingRow.ts`
- Create: `lib/db/meetingDocRepository.ts`
- Test: `tests/db/meetingDocRepository.test.ts`

- [ ] **Step 1: マイグレーションを作成**

`migrations/0006_add_meeting_doc.sql`:

```sql
-- Meet 議事録 (Google Docs) の検出結果を保持し、処理済み管理に使う
CREATE TABLE IF NOT EXISTS meeting_doc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_event_id TEXT NOT NULL UNIQUE,
  document_id TEXT,
  title TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  doc_url TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_doc_unprocessed
  ON meeting_doc (processed_at, occurred_at);
```

- [ ] **Step 2: 行型を定義**

`lib/types/meetingRow.ts`:

```typescript
export interface MeetingDocRow {
  id: number;
  calendar_event_id: string;
  document_id: string | null;
  title: string;
  occurred_at: string;
  doc_url: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 検出時に upsert する入力 (候補は永続化しない) */
export interface MeetingDocUpsert {
  calendarEventId: string;
  documentId?: string;
  title: string;
  occurredAt: string;
  docUrl?: string;
}
```

- [ ] **Step 3: 失敗するテストを書く**

`tests/db/meetingDocRepository.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/lib/db/connection";
import {
  upsertMeetingDoc,
  listMeetingDocs,
  markMeetingDocProcessed,
  findMeetingDocById,
} from "@/lib/db/meetingDocRepository";

beforeEach(() => {
  process.env.NODE_ENV = "test";
});
afterEach(() => closeDb());

const sample = {
  calendarEventId: "evt-1",
  documentId: "doc-1",
  title: "定例MTG",
  occurredAt: "2026-06-10T01:00:00.000Z",
  docUrl: "https://docs.google.com/document/d/doc-1/edit",
};

describe("meetingDocRepository", () => {
  it("upsert で作成し calendarEventId で一意に更新する", () => {
    const created = upsertMeetingDoc(sample);
    expect(created.id).toBeGreaterThan(0);
    const updated = upsertMeetingDoc({ ...sample, title: "定例MTG(改)" });
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe("定例MTG(改)");
  });

  it("未処理のみを一覧できる", () => {
    const m = upsertMeetingDoc(sample);
    expect(listMeetingDocs(false).some((d) => d.id === m.id)).toBe(true);
    markMeetingDocProcessed(m.id);
    expect(listMeetingDocs(false).some((d) => d.id === m.id)).toBe(false);
    expect(findMeetingDocById(m.id)?.processedAt).toBeTruthy();
  });
});
```

> 注: 既存テストの DB 利用方針 (in-memory or temp file) に合わせること。既存に DB テストが無い場合は、
> `data/` 配下の実 SQLite を使うため、テスト後に `meeting_doc` 行を消すか専用 DB パスを使う方針を
> 既存 `connection.ts` の慣習に合わせて選択する。本テストが実 DB を汚す場合は `calendarEventId` を
> `test-` プレフィックスにして後始末する。

- [ ] **Step 4: テストを実行して失敗を確認**

Run: `npm test -- meetingDocRepository`
Expected: FAIL ("Cannot find module")

- [ ] **Step 5: リポジトリを実装**

`lib/db/meetingDocRepository.ts`:

```typescript
import "server-only";
import { getDb } from "./connection";
import { DatabaseError } from "../errors";
import type { MeetingDocRow, MeetingDocUpsert } from "../types/meetingRow";
import type { MeetingDoc } from "../types/meeting";

function toMeetingDoc(row: MeetingDocRow): MeetingDoc {
  return {
    id: row.id,
    calendarEventId: row.calendar_event_id,
    documentId: row.document_id ?? undefined,
    title: row.title,
    occurredAt: row.occurred_at,
    docUrl: row.doc_url ?? undefined,
    candidates: [],
    processedAt: row.processed_at ?? undefined,
  };
}

export function findMeetingDocById(id: number): MeetingDoc | undefined {
  try {
    const row = getDb()
      .prepare<[number], MeetingDocRow>("SELECT * FROM meeting_doc WHERE id = ?")
      .get(id);
    return row ? toMeetingDoc(row) : undefined;
  } catch (error) {
    throw new DatabaseError("議事録の取得に失敗", error);
  }
}

export function listMeetingDocs(includeProcessed = false): MeetingDoc[] {
  try {
    const where = includeProcessed ? "" : "WHERE processed_at IS NULL";
    const rows = getDb()
      .prepare<[], MeetingDocRow>(`SELECT * FROM meeting_doc ${where} ORDER BY occurred_at DESC`)
      .all();
    return rows.map(toMeetingDoc);
  } catch (error) {
    throw new DatabaseError("議事録一覧の取得に失敗", error);
  }
}

export function upsertMeetingDoc(input: MeetingDocUpsert): MeetingDoc {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO meeting_doc (calendar_event_id, document_id, title, occurred_at, doc_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(calendar_event_id) DO UPDATE SET
         document_id = excluded.document_id,
         title = excluded.title,
         occurred_at = excluded.occurred_at,
         doc_url = excluded.doc_url,
         updated_at = excluded.updated_at`,
    ).run(
      input.calendarEventId,
      input.documentId ?? null,
      input.title,
      input.occurredAt,
      input.docUrl ?? null,
      now,
      now,
    );
    const row = db
      .prepare<[string], MeetingDocRow>("SELECT * FROM meeting_doc WHERE calendar_event_id = ?")
      .get(input.calendarEventId);
    if (!row) throw new DatabaseError("upsert 直後の議事録が取得できませんでした");
    return toMeetingDoc(row);
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError("議事録の保存に失敗", error);
  }
}

export function markMeetingDocProcessed(id: number): void {
  try {
    getDb()
      .prepare("UPDATE meeting_doc SET processed_at = ?, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), new Date().toISOString(), id);
  } catch (error) {
    throw new DatabaseError("議事録の処理済みマークに失敗", error);
  }
}
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm test -- meetingDocRepository`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add migrations/0006_add_meeting_doc.sql lib/types/meetingRow.ts lib/db/meetingDocRepository.ts tests/db/meetingDocRepository.test.ts
git commit -m "feat: meeting_doc マイグレーションとリポジトリを追加"
```

---

### Task 13: Calendar 型/クライアントに attachments・attendees を追加

**Files:**
- Modify: `lib/types/calendar.ts`
- Modify: `lib/clients/googleCalendar.ts:20-36` (`toCalendarEvent`)

- [ ] **Step 1: 影響分析 (CLAUDE.md 必須)**

Run (MCP): `gitnexus_impact({ target: "toCalendarEvent", direction: "upstream" })`
かつ `gitnexus_impact({ target: "listEvents", direction: "upstream" })`
HIGH/CRITICAL の場合はユーザーに報告してから着手する。追加プロパティは任意であり既存表示・作成・編集には影響させない方針。

- [ ] **Step 2: 型を拡張**

`lib/types/calendar.ts` の `CalendarEvent` に以下を追加:

```typescript
export interface CalendarEventAttachment {
  fileId?: string;
  fileUrl?: string;
  title?: string;
  mimeType?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  htmlLink?: string;
  colorId?: GoogleEventColorId;
  attachments?: CalendarEventAttachment[];
  /** 自分が参加者または主催者だったか (FR-002 の対象判定用) */
  attended?: boolean;
}
```

- [ ] **Step 3: `toCalendarEvent` を拡張**

`lib/clients/googleCalendar.ts` の `toCalendarEvent` の return 直前に以下を追加し、return オブジェクトへ反映:

```typescript
  const attachments = (api.attachments ?? []).map((a) => ({
    fileId: a.fileId ?? undefined,
    fileUrl: a.fileUrl ?? undefined,
    title: a.title ?? undefined,
    mimeType: a.mimeType ?? undefined,
  }));
  const attended =
    api.organizer?.self === true ||
    (api.attendees ?? []).some((at) => at.self === true);
```

return オブジェクトに `attachments, attended` を追加する。

- [ ] **Step 4: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 5: detect_changes で確認**

Run (MCP): `gitnexus_detect_changes()` で変更が `toCalendarEvent` / `CalendarEvent` 周辺に限定されることを確認。

- [ ] **Step 6: Commit**

```bash
git add lib/types/calendar.ts lib/clients/googleCalendar.ts
git commit -m "feat: CalendarEvent に attachments と attended を追加"
```

---

### Task 14: 議事録紐付けの純粋関数

**Files:**
- Create: `lib/services/meeting/linkMeetingDoc.ts`
- Test: `tests/services/linkMeetingDoc.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/services/linkMeetingDoc.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { docIdFromAttachments, pickDriveMatch } from "@/lib/services/meeting/linkMeetingDoc";

describe("docIdFromAttachments", () => {
  it("Google Docs の添付から fileId を取り出す", () => {
    const att = [{ mimeType: "application/vnd.google-apps.document", fileId: "doc-1" }];
    expect(docIdFromAttachments(att)).toBe("doc-1");
  });

  it("Docs 以外の添付は無視する", () => {
    expect(docIdFromAttachments([{ mimeType: "application/pdf", fileId: "p" }])).toBeNull();
  });

  it("空配列は null", () => {
    expect(docIdFromAttachments([])).toBeNull();
  });
});

describe("pickDriveMatch", () => {
  const files = [
    { id: "a", name: "営業定例 議事録", modifiedTime: "2026-06-10T05:00:00Z" },
    { id: "b", name: "別件メモ", modifiedTime: "2026-06-10T05:00:00Z" },
  ];

  it("予定タイトルを含む Docs を優先して返す", () => {
    expect(pickDriveMatch("営業定例", files)?.id).toBe("a");
  });

  it("マッチが無ければ null", () => {
    expect(pickDriveMatch("存在しない会議", files)).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- linkMeetingDoc`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: 実装**

`lib/services/meeting/linkMeetingDoc.ts`:

```typescript
import type { CalendarEventAttachment } from "../../types/calendar";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

export interface DriveFileLite {
  id: string;
  name: string;
  modifiedTime?: string;
}

/** 予定の添付から Google Docs の fileId を取り出す。無ければ null */
export function docIdFromAttachments(attachments: CalendarEventAttachment[]): string | null {
  const doc = attachments.find((a) => a.mimeType === GOOGLE_DOC_MIME && a.fileId);
  return doc?.fileId ?? null;
}

/** Drive 検索結果から、予定タイトルを名前に含む最初の Docs を選ぶ。無ければ null */
export function pickDriveMatch(eventTitle: string, files: DriveFileLite[]): DriveFileLite | null {
  const title = eventTitle.trim();
  if (!title) return null;
  return files.find((f) => f.name.includes(title)) ?? null;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- linkMeetingDoc`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/meeting/linkMeetingDoc.ts tests/services/linkMeetingDoc.test.ts
git commit -m "feat: 議事録自動紐付けの純粋関数を追加"
```

---

### Task 15: Drive 検索クライアント

**Files:**
- Create: `lib/clients/googleDrive.ts`

- [ ] **Step 1: 実装**

`lib/clients/googleDrive.ts`:

```typescript
import "server-only";
import { google } from "googleapis";
import { getOAuth2Client } from "./googleAuth";
import { ExternalApiError } from "../errors";
import type { DriveFileLite } from "../services/meeting/linkMeetingDoc";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

/** 名前に nameContains を含む Google Docs を検索する (Drive readonly スコープ必要) */
export async function searchDocs(nameContains: string): Promise<DriveFileLite[]> {
  try {
    const drive = google.drive({ version: "v3", auth: getOAuth2Client() });
    const safe = nameContains.replace(/'/g, "\\'");
    const res = await drive.files.list({
      q: `mimeType='${GOOGLE_DOC_MIME}' and name contains '${safe}' and trashed=false`,
      fields: "files(id,name,modifiedTime)",
      pageSize: 20,
      orderBy: "modifiedTime desc",
    });
    return (res.data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "",
      modifiedTime: f.modifiedTime ?? undefined,
    }));
  } catch (error) {
    const e = error as { code?: number; message?: string };
    if (e.code === 401 || e.code === 403) {
      throw new ExternalApiError(
        "Google Drive の認証に失敗しました (Drive スコープ不足の可能性)。マニュアルの追加スコープ手順を確認してください",
        "auth",
        false,
        e.code,
        error,
      );
    }
    throw new ExternalApiError(`Google Drive API エラー: ${e.message ?? ""}`, "unknown", false, e.code, error);
  }
}
```

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add lib/clients/googleDrive.ts
git commit -m "feat: Drive Docs 検索クライアントを追加"
```

---

### Task 16: 議事録サービス (検出オーケストレーション)

**Files:**
- Create: `lib/services/meetingService.ts`
- Test: `tests/services/meetingService.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (検出の純粋ロジックを検証)

`tests/services/meetingService.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { resolveDocId } from "@/lib/services/meetingService";

describe("resolveDocId", () => {
  it("添付があれば添付の fileId を優先する", async () => {
    const event = {
      title: "定例",
      attachments: [{ mimeType: "application/vnd.google-apps.document", fileId: "att-1" }],
    };
    const id = await resolveDocId(event, async () => [{ id: "drive-1", name: "定例 議事録" }]);
    expect(id).toBe("att-1");
  });

  it("添付が無ければ Drive 検索でタイトル一致を使う", async () => {
    const event = { title: "営業会議", attachments: [] };
    const id = await resolveDocId(event, async () => [{ id: "drive-2", name: "営業会議 議事録" }]);
    expect(id).toBe("drive-2");
  });

  it("どちらも無ければ null", async () => {
    const event = { title: "雑談", attachments: [] };
    const id = await resolveDocId(event, async () => []);
    expect(id).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- meetingService`
Expected: FAIL ("Cannot find module")

- [ ] **Step 3: 実装**

`lib/services/meetingService.ts`:

```typescript
import "server-only";
import { listEvents } from "../clients/googleCalendar";
import { searchDocs } from "../clients/googleDrive";
import { getDocumentText } from "../clients/googleDocs";
import { upsertMeetingDoc, listMeetingDocs, findMeetingDocById } from "../db/meetingDocRepository";
import { extractCandidatesFromText } from "./aiExtractionService";
import { getAppSettings } from "../db/settingsRepository";
import { docIdFromAttachments, pickDriveMatch, type DriveFileLite } from "./meeting/linkMeetingDoc";
import type { CalendarEventAttachment } from "../types/calendar";
import type { MeetingDoc } from "../types/meeting";
import type { TicketCandidate } from "../types/ticket";
import { NotFoundError } from "../errors";

type DriveSearchFn = (nameContains: string) => Promise<DriveFileLite[]>;

interface EventLike {
  title: string;
  attachments?: CalendarEventAttachment[];
}

/** 予定から documentId を解決する。添付優先、無ければ Drive 検索。純粋寄りの関数 (検索関数を注入) */
export async function resolveDocId(event: EventLike, search: DriveSearchFn): Promise<string | null> {
  const fromAtt = docIdFromAttachments(event.attachments ?? []);
  if (fromAtt) return fromAtt;
  const files = await search(event.title);
  return pickDriveMatch(event.title, files)?.id ?? null;
}

function docUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}

/**
 * 終了済み・自分参加の予定を走査し、議事録 Docs を紐付けて upsert する。
 * 過去 14 日分を対象とする。
 */
export async function detectMeetingDocs(): Promise<MeetingDoc[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const events = await listEvents(from.toISOString(), now.toISOString());
  for (const ev of events) {
    if (ev.attended === false) continue;
    const documentId = await resolveDocId({ title: ev.title, attachments: ev.attachments }, searchDocs);
    if (!documentId) continue;
    upsertMeetingDoc({
      calendarEventId: ev.id,
      documentId,
      title: ev.title,
      occurredAt: ev.start,
      docUrl: docUrl(documentId),
    });
  }
  return listMeetingDocs(false);
}

const selfName = () => getAppSettings().backlog.self?.name;

/** 指定議事録の本文を取得し AI 抽出する */
export async function extractMeetingCandidates(meetingDocId: number): Promise<TicketCandidate[]> {
  const meeting = findMeetingDocById(meetingDocId);
  if (!meeting || !meeting.documentId) {
    throw new NotFoundError("議事録または紐づくドキュメントが見つかりません");
  }
  const text = await getDocumentText(meeting.documentId);
  return extractCandidatesFromText({
    text,
    sourceMeta: { kind: "meeting", ref: meeting.docUrl ?? meeting.documentId },
    selfName: selfName(),
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- meetingService`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/services/meetingService.ts tests/services/meetingService.test.ts
git commit -m "feat: 議事録検出・抽出サービスを追加"
```

---

### Task 17: 議事録 API ルート

**Files:**
- Create: `app/api/meetings/route.ts`
- Create: `app/api/meetings/[id]/extract/route.ts`
- Create: `app/api/meetings/[id]/route.ts`

- [ ] **Step 1: 一覧 (検出) API を実装**

`app/api/meetings/route.ts`:

```typescript
import { detectMeetingDocs } from "@/lib/services/meetingService";
import { errorResponse, ok } from "@/lib/http/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const meetings = await detectMeetingDocs();
    return ok({ meetings });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 2: 抽出 API を実装**

`app/api/meetings/[id]/extract/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { extractMeetingCandidates } from "@/lib/services/meetingService";
import { errorResponse, ok } from "@/lib/http/response";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meetingId = Number(id);
    if (!Number.isInteger(meetingId) || meetingId <= 0) {
      throw new ValidationError("議事録 ID が不正です");
    }
    const candidates = await extractMeetingCandidates(meetingId);
    return ok({ candidates });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 3: 処理済みマーク API を実装**

`app/api/meetings/[id]/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { markMeetingDocProcessed } from "@/lib/db/meetingDocRepository";
import { errorResponse, ok } from "@/lib/http/response";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meetingId = Number(id);
    if (!Number.isInteger(meetingId) || meetingId <= 0) {
      throw new ValidationError("議事録 ID が不正です");
    }
    markMeetingDocProcessed(meetingId);
    return ok({ processed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 4: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 5: Commit**

```bash
git add app/api/meetings
git commit -m "feat: 議事録の一覧・抽出・処理済み API を追加"
```

---

### Task 18: FR-002 議事録 UI

**Files:**
- Create: `app/meetings/page.tsx`
- Create: `components/MeetingExtractPane.tsx`

- [ ] **Step 1: ページシェルを実装**

`app/meetings/page.tsx`:

```tsx
import MeetingExtractPane from "@/components/MeetingExtractPane";

export const metadata = { title: "議事録抽出 | Task Maestro" };

export default function MeetingsPage() {
  return (
    <section className="page">
      <h1>議事録からタスク抽出</h1>
      <p className="page-desc">終了した予定に紐づく Meet 議事録を検出し、自分のネクストアクションを抽出します。</p>
      <MeetingExtractPane />
    </section>
  );
}
```

- [ ] **Step 2: 抽出ペインを実装**

`components/MeetingExtractPane.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetingDoc } from "@/lib/types/meeting";
import type { TicketCandidate } from "@/lib/types/ticket";

interface EditableCandidate extends TicketCandidate {
  selected: boolean;
  projectId: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "取得に失敗しました");
  return data as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? "リクエストに失敗しました");
  return data as T;
}

export default function MeetingExtractPane() {
  const [meetings, setMeetings] = useState<MeetingDoc[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await getJson<{ meetings: MeetingDoc[] }>("/api/meetings");
      setMeetings(data.meetings);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  async function handleExtract(id: number) {
    setBusy(true);
    setError(null);
    setActiveId(id);
    try {
      const data = await postJson<{ candidates: TicketCandidate[] }>(`/api/meetings/${id}/extract`);
      setCandidates(data.candidates.map((c) => ({ ...c, selected: true, projectId: "" })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updateCandidate(idx: number, patch: Partial<EditableCandidate>) {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  async function handleCreateAndComplete() {
    if (activeId == null) return;
    setBusy(true);
    setError(null);
    try {
      const active = meetings.find((m) => m.id === activeId);
      const ref = active?.docUrl ?? "";
      const targets = candidates.filter((c) => c.selected && c.projectId);
      for (const c of targets) {
        await postJson("/api/backlog/issues", {
          projectId: Number(c.projectId),
          summary: c.title,
          description: c.body ? `${c.body}\n\n${ref}` : ref,
          dueDate: c.suggested_due,
          sourceMeta: { kind: "meeting", ref },
        });
      }
      await postJson(`/api/meetings/${activeId}`);
      setCandidates([]);
      setActiveId(null);
      await loadMeetings();
      setError(`${targets.length} 件のチケットを作成し、議事録を処理済みにしました`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="meeting-pane">
      {error && <p className="extract-error" role="alert">{error}</p>}
      <button onClick={loadMeetings} disabled={busy}>議事録を再検出</button>

      <ul className="meeting-list">
        {meetings.length === 0 && <li>未処理の議事録はありません。</li>}
        {meetings.map((m) => (
          <li key={m.id} className="meeting-item">
            <span>{m.title}</span>
            <span className="meeting-date">{m.occurredAt}</span>
            {m.docUrl && <a href={m.docUrl} target="_blank" rel="noreferrer">議事録</a>}
            <button onClick={() => handleExtract(m.id)} disabled={busy}>抽出</button>
          </li>
        ))}
      </ul>

      {activeId != null && (
        <div className="extract-candidates">
          {candidates.length === 0 && <p>抽出されたネクストアクションはありませんでした。</p>}
          {candidates.map((c, i) => (
            <div key={i} className="candidate-row">
              <input
                type="checkbox"
                checked={c.selected}
                onChange={(e) => updateCandidate(i, { selected: e.target.checked })}
                aria-label="チケット化対象"
              />
              <input value={c.title} onChange={(e) => updateCandidate(i, { title: e.target.value })} aria-label="タイトル" />
              <input
                value={c.projectId}
                onChange={(e) => updateCandidate(i, { projectId: e.target.value })}
                placeholder="プロジェクト ID"
                aria-label="プロジェクト ID"
              />
              <input
                value={c.suggested_due ?? ""}
                onChange={(e) => updateCandidate(i, { suggested_due: e.target.value || undefined })}
                placeholder="YYYY-MM-DD"
                aria-label="期限"
              />
            </div>
          ))}
          {candidates.length > 0 && (
            <button onClick={handleCreateAndComplete} disabled={busy}>選択をチケット化して処理済みに</button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add app/meetings/page.tsx components/MeetingExtractPane.tsx
git commit -m "feat: 議事録抽出ページと抽出ペインを追加"
```

---

### Task 19: ナビゲーションにリンク追加

**Files:**
- Modify: `app/layout.tsx:55-62` (`<nav>`)

- [ ] **Step 1: 影響分析 (CLAUDE.md 必須)**

Run (MCP): `gitnexus_impact({ target: "RootLayout", direction: "upstream" })`
HIGH/CRITICAL の場合はユーザーに報告。レイアウトの nav 追加のみで挙動への影響は小さい想定。

- [ ] **Step 2: ナビにリンクを追加**

`app/layout.tsx` の `<nav className="nav">` 内、`/issues` の後に追加:

```tsx
            <Link href="/issues">チケット一覧</Link>
            <Link href="/documents">ドキュメント</Link>
            <Link href="/meetings">議事録</Link>
            <Link href="/manual">マニュアル</Link>
```

- [ ] **Step 3: 型チェックとビルド確認**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 4: detect_changes で確認**

Run (MCP): `gitnexus_detect_changes()` で変更が `RootLayout` に限定されることを確認。

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: ナビにドキュメント・議事録リンクを追加"
```

---

## Phase 4: 全体確認

### Task 20: 通し確認

- [ ] **Step 1: 全テスト**

Run: `npm test`
Expected: 全 PASS

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: エラーなし

- [ ] **Step 4: 手動 E2E (任意)**

`npm run dev` で以下を確認:
- `/documents`: Docs URL → 本文プレビュー → 抽出 → チケット化
- `/meetings`: 再検出 → 抽出 → チケット化＋処理済み

---

## Self-Review メモ (spec カバレッジ)

- FR-007 (手動 Docs): Task 7-11 ✔ (Markdown 経路はスコープ外と明記)
- FR-002 (議事録自動): Task 12-18 ✔
- AI プロバイダ切替 (FR-009): Task 4/5/6 ✔ (設定型は既存)
- 外部送信前プレビュー (非機能): Task 11 (preview phase) / Task 18 (議事録本文は Docs リンクで確認) ✔
- スコープ再発行 (前提): Task 0 ✔
- 既存シンボル変更時の impact 分析 (CLAUDE.md): Task 13/19 ✔
