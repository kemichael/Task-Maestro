import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// vi.mock ファクトリは巻き上げ (hoist) されるため、ファクトリ内で参照する変数は
// vi.hoisted() で同様に巻き上げておく必要がある。
// また vi.hoisted() 内では static import が使えないため require を使う。
const { execFileCustomMock, execFileMock } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { promisify } = require("node:util") as typeof import("node:util");
  const execFileCustomMock = vi.fn<() => Promise<{ stdout: string; stderr: string }>>();
  // node:child_process の execFile に promisify.custom シンボルを付与してモック:
  // Node.js 本来の execFile は util.promisify.custom を持ち、
  // promisify 後の Promise 解決値が { stdout, stderr } オブジェクトになる。
  // モック関数にも同シンボルを設定しないと promisify は通常コールバック形式 (err, value) で動き、
  // value = stdout 文字列となって const { stdout } = ... の分割代入が undefined になる。
  const execFileMock = Object.assign(vi.fn(), {
    [promisify.custom]: execFileCustomMock,
  });
  return { execFileCustomMock, execFileMock };
});

vi.mock("node:child_process", () => ({ execFile: execFileMock }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ CLAUDE_CODE_PATH: "/usr/bin/claude" }) }));

import { createClaudeCodeProvider } from "@/lib/services/ai/claudeCodeProvider";

afterEach(() => vi.restoreAllMocks());

// promisify.custom を通じて { stdout, stderr } を返すように制御するヘルパー
function mockExec(stdout: string, err: Error | null = null) {
  if (err) {
    execFileCustomMock.mockRejectedValueOnce(err);
  } else {
    execFileCustomMock.mockResolvedValueOnce({ stdout, stderr: "" });
  }
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
