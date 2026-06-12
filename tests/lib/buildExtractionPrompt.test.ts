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
