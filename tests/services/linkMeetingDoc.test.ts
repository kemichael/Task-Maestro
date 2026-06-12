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
