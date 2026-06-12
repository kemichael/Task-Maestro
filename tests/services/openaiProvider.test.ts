import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
