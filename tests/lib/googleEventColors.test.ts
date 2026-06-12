import { describe, expect, it } from "vitest";
import {
  GOOGLE_EVENT_COLORS,
  DEFAULT_CALENDAR_COLOR,
  resolveEventColor,
} from "@/lib/constants/googleEventColors";

describe("GOOGLE_EVENT_COLORS", () => {
  it("11 色を含む", () => {
    expect(GOOGLE_EVENT_COLORS).toHaveLength(11);
  });

  it("id が '1' から '11' まで連番", () => {
    expect(GOOGLE_EVENT_COLORS.map((c) => c.id)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
    ]);
  });

  it("各色は background / foreground / name を持つ", () => {
    for (const c of GOOGLE_EVENT_COLORS) {
      expect(c.name).toMatch(/.+/);
      expect(c.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.foreground).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("resolveEventColor", () => {
  it("colorId なしは DEFAULT_CALENDAR_COLOR", () => {
    expect(resolveEventColor(undefined)).toBe(DEFAULT_CALENDAR_COLOR);
  });

  it("colorId='7' で Peacock を返す", () => {
    const c = resolveEventColor("7");
    expect(c.background).toBe("#039be5");
  });

  it("範囲外 colorId は DEFAULT を返す (型で防がれてもガード)", () => {
    // @ts-expect-error 範囲外を意図的に渡す
    const c = resolveEventColor("99");
    expect(c).toBe(DEFAULT_CALENDAR_COLOR);
  });
});
