import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
