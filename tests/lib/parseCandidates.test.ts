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
