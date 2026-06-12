import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPatch = vi.fn();
const mockInsert = vi.fn();
const mockList = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({
      events: {
        patch: mockPatch,
        insert: mockInsert,
        list: mockList,
        get: mockGet,
        delete: mockDelete,
      },
    }),
  },
}));

vi.mock("@/lib/clients/googleAuth", () => ({
  getOAuth2Client: () => ({}),
}));

import {
  listEvents,
  createEvent,
  patchEvent,
} from "@/lib/clients/googleCalendar";

beforeEach(() => {
  mockPatch.mockReset();
  mockInsert.mockReset();
  mockList.mockReset();
});

describe("toCalendarEvent (listEvents 経由)", () => {
  it("colorId を抽出する", async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          {
            id: "e1",
            summary: "test",
            start: { dateTime: "2026-06-05T10:00:00Z" },
            end:   { dateTime: "2026-06-05T11:00:00Z" },
            colorId: "7",
          },
        ],
      },
    });
    const events = await listEvents("2026-06-05T00:00:00Z", "2026-06-06T00:00:00Z");
    expect(events[0].colorId).toBe("7");
  });

  it("colorId なしは undefined", async () => {
    mockList.mockResolvedValue({
      data: {
        items: [
          {
            id: "e2",
            summary: "no color",
            start: { dateTime: "2026-06-05T10:00:00Z" },
            end:   { dateTime: "2026-06-05T11:00:00Z" },
          },
        ],
      },
    });
    const events = await listEvents("2026-06-05T00:00:00Z", "2026-06-06T00:00:00Z");
    expect(events[0].colorId).toBeUndefined();
  });
});

describe("createEvent", () => {
  it("colorId を requestBody に含める", async () => {
    mockInsert.mockResolvedValue({
      data: { id: "n1", summary: "x", start: { dateTime: "x" }, end: { dateTime: "y" } },
    });
    await createEvent({
      title: "x",
      start: "2026-06-05T10:00:00Z",
      end:   "2026-06-05T11:00:00Z",
      colorId: "5",
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0].requestBody.colorId).toBe("5");
  });

  it("colorId 未指定なら requestBody.colorId は含まれない", async () => {
    mockInsert.mockResolvedValue({
      data: { id: "n2", summary: "x", start: { dateTime: "x" }, end: { dateTime: "y" } },
    });
    await createEvent({
      title: "x",
      start: "2026-06-05T10:00:00Z",
    });
    expect(mockInsert.mock.calls[0][0].requestBody).not.toHaveProperty("colorId");
  });
});

describe("patchEvent", () => {
  beforeEach(() => {
    mockPatch.mockResolvedValue({
      data: { id: "e", summary: "x", start: { dateTime: "x" }, end: { dateTime: "y" } },
    });
  });

  it("colorId 文字列は requestBody.colorId に入る", async () => {
    await patchEvent("e", { colorId: "11" });
    expect(mockPatch.mock.calls[0][0].requestBody.colorId).toBe("11");
  });

  it("colorId=null は requestBody.colorId=null として送信", async () => {
    await patchEvent("e", { colorId: null });
    expect(mockPatch.mock.calls[0][0].requestBody).toHaveProperty("colorId", null);
  });

  it("colorId 未指定なら requestBody.colorId は含まれない", async () => {
    await patchEvent("e", { title: "rename" });
    expect(mockPatch.mock.calls[0][0].requestBody).not.toHaveProperty("colorId");
  });
});
