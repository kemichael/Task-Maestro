import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { flattenDocumentText } from "@/lib/clients/googleDocs";

describe("flattenDocumentText", () => {
  it("段落の textRun を連結する", () => {
    const doc = {
      body: {
        content: [
          { paragraph: { elements: [{ textRun: { content: "一行目\n" } }] } },
          { paragraph: { elements: [{ textRun: { content: "二行目\n" } }] } },
        ],
      },
    };
    expect(flattenDocumentText(doc)).toBe("一行目\n二行目\n");
  });
  it("textRun を持たない要素は無視する", () => {
    const doc = { body: { content: [{ tableOfContents: {} }, { paragraph: { elements: [{ textRun: { content: "本文" } }] } }] } };
    expect(flattenDocumentText(doc)).toBe("本文");
  });
  it("body が無ければ空文字", () => {
    expect(flattenDocumentText({})).toBe("");
  });
});
