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
