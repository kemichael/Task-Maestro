import { describe, expect, it } from "vitest";
import {
  ticketDraftSchema,
  patchIssueSchema,
  calendarEventCreateSchema,
  calendarEventPatchSchema,
} from "@/lib/validation/ticketSchema";

describe("ticketDraftSchema", () => {
  it("最小入力 (projectId + summary) で通る", () => {
    const result = ticketDraftSchema.safeParse({ projectId: 100, summary: "テスト" });
    expect(result.success).toBe(true);
  });

  it("summary 空は弾く", () => {
    const result = ticketDraftSchema.safeParse({ projectId: 100, summary: "" });
    expect(result.success).toBe(false);
  });

  it("projectId が負数なら弾く", () => {
    const result = ticketDraftSchema.safeParse({ projectId: -1, summary: "テスト" });
    expect(result.success).toBe(false);
  });

  it("dueDate は YYYY-MM-DD のみ許容", () => {
    expect(ticketDraftSchema.safeParse({ projectId: 1, summary: "x", dueDate: "2026-12-31" }).success).toBe(true);
    expect(ticketDraftSchema.safeParse({ projectId: 1, summary: "x", dueDate: "2026/12/31" }).success).toBe(false);
    expect(ticketDraftSchema.safeParse({ projectId: 1, summary: "x", dueDate: "2026-12-31T00:00:00Z" }).success).toBe(
      false,
    );
  });

  it("priority は 3 種のいずれか", () => {
    expect(ticketDraftSchema.safeParse({ projectId: 1, summary: "x", priority: "low" }).success).toBe(true);
    expect(ticketDraftSchema.safeParse({ projectId: 1, summary: "x", priority: "urgent" }).success).toBe(false);
  });

  it("sourceMeta は kind と ref を要求", () => {
    expect(
      ticketDraftSchema.safeParse({
        projectId: 1,
        summary: "x",
        sourceMeta: { kind: "slack", ref: "https://example.com" },
      }).success,
    ).toBe(true);
    expect(
      ticketDraftSchema.safeParse({
        projectId: 1,
        summary: "x",
        sourceMeta: { kind: "invalid", ref: "x" },
      }).success,
    ).toBe(false);
  });
});

describe("patchIssueSchema", () => {
  it("空オブジェクトを許容 (パッチなしも合法)", () => {
    expect(patchIssueSchema.safeParse({}).success).toBe(true);
  });

  it("dueDate に null を許容 (期限解除)", () => {
    expect(patchIssueSchema.safeParse({ dueDate: null }).success).toBe(true);
  });

  it("statusId が 0 以下なら弾く", () => {
    expect(patchIssueSchema.safeParse({ statusId: 0 }).success).toBe(false);
    expect(patchIssueSchema.safeParse({ statusId: -1 }).success).toBe(false);
  });
});

describe("calendarEventCreateSchema", () => {
  it("title と start が必須", () => {
    expect(calendarEventCreateSchema.safeParse({ title: "", start: "2026-01-01T09:00:00Z" }).success).toBe(false);
    expect(calendarEventCreateSchema.safeParse({ title: "x", start: "" }).success).toBe(false);
    expect(calendarEventCreateSchema.safeParse({ title: "x", start: "2026-01-01T09:00:00Z" }).success).toBe(true);
  });
});

describe("calendarEventCreateSchema (colorId)", () => {
  it("colorId なしは通る", () => {
    const r = calendarEventCreateSchema.safeParse({
      title: "x",
      start: "2026-06-05T10:00:00Z",
    });
    expect(r.success).toBe(true);
  });

  it("colorId='7' は通る", () => {
    const r = calendarEventCreateSchema.safeParse({
      title: "x",
      start: "2026-06-05T10:00:00Z",
      colorId: "7",
    });
    expect(r.success).toBe(true);
  });

  it("colorId='12' は弾く", () => {
    const r = calendarEventCreateSchema.safeParse({
      title: "x",
      start: "2026-06-05T10:00:00Z",
      colorId: "12",
    });
    expect(r.success).toBe(false);
  });

  it("colorId が数値の 7 は弾く (文字列必須)", () => {
    const r = calendarEventCreateSchema.safeParse({
      title: "x",
      start: "2026-06-05T10:00:00Z",
      colorId: 7,
    });
    expect(r.success).toBe(false);
  });
});

describe("calendarEventPatchSchema (colorId)", () => {
  it("colorId='11' は通る", () => {
    const r = calendarEventPatchSchema.safeParse({ colorId: "11" });
    expect(r.success).toBe(true);
  });

  it("colorId=null は通る (Default 化)", () => {
    const r = calendarEventPatchSchema.safeParse({ colorId: null });
    expect(r.success).toBe(true);
  });

  it("colorId=undefined は通る (変更しない)", () => {
    const r = calendarEventPatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("colorId='0' は弾く", () => {
    const r = calendarEventPatchSchema.safeParse({ colorId: "0" });
    expect(r.success).toBe(false);
  });
});
