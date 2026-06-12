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
