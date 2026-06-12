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

  it("JSON モードで任意キーにラップされた配列をフォールバックで取り出す", () => {
    expect(parseCandidates('{"tasks":[{"title":"C"}]}')).toEqual([{ title: "C" }]);
  });

  it("title 以外のキー名 (task/name) も拾う", () => {
    expect(parseCandidates('[{"task":"X"},{"name":"Y"}]')).toEqual([{ title: "X" }, { title: "Y" }]);
  });

  it("解釈できない期限は捨てて候補は残す", () => {
    expect(parseCandidates('[{"title":"A","suggested_due":"来週"}]')).toEqual([{ title: "A" }]);
  });

  it("YYYY/MM/DD 形式の期限を正規化する", () => {
    expect(parseCandidates('[{"title":"A","suggested_due":"2026/6/5"}]')).toEqual([
      { title: "A", suggested_due: "2026-06-05" },
    ]);
  });

  it("ISO 日時の期限は日付部分に正規化する", () => {
    expect(parseCandidates('[{"title":"A","suggested_due":"2026-06-15T09:00:00Z"}]')).toEqual([
      { title: "A", suggested_due: "2026-06-15" },
    ]);
  });

  it("タスクが無い空配列は空を返す (エラーにしない)", () => {
    expect(parseCandidates('{"candidates":[]}')).toEqual([]);
  });

  it("title を持つ要素が皆無なら AiProviderError", () => {
    expect(() => parseCandidates('[{"foo":"bar"}]')).toThrow(AiProviderError);
  });

  it("不正 JSON は AiProviderError を投げる", () => {
    expect(() => parseCandidates("これは JSON ではない")).toThrow(AiProviderError);
  });

  it("スキーマ違反は AiProviderError を投げる", () => {
    expect(() => parseCandidates('[{"body":"title なし"}]')).toThrow(AiProviderError);
  });
});
