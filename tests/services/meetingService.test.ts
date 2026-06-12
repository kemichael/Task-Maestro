import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
