import type { GoogleEventColorId } from "@/lib/types/calendar";

export interface GoogleEventColor {
  id: GoogleEventColorId;
  name: string;
  background: string;
  foreground: string;
}

export const GOOGLE_EVENT_COLORS: readonly GoogleEventColor[] = [
  { id: "1",  name: "Lavender",  background: "#7986cb", foreground: "#ffffff" },
  { id: "2",  name: "Sage",      background: "#33b679", foreground: "#ffffff" },
  { id: "3",  name: "Grape",     background: "#8e24aa", foreground: "#ffffff" },
  { id: "4",  name: "Flamingo",  background: "#e67c73", foreground: "#ffffff" },
  { id: "5",  name: "Banana",    background: "#f6c026", foreground: "#1d1d1d" },
  { id: "6",  name: "Tangerine", background: "#f5511d", foreground: "#ffffff" },
  { id: "7",  name: "Peacock",   background: "#039be5", foreground: "#ffffff" },
  { id: "8",  name: "Graphite",  background: "#616161", foreground: "#ffffff" },
  { id: "9",  name: "Blueberry", background: "#3f51b5", foreground: "#ffffff" },
  { id: "10", name: "Basil",     background: "#0b8043", foreground: "#ffffff" },
  { id: "11", name: "Tomato",    background: "#d60000", foreground: "#ffffff" },
];

export const DEFAULT_CALENDAR_COLOR = {
  background: "#039be5",
  foreground: "#ffffff",
} as const;

export function resolveEventColor(
  colorId: GoogleEventColorId | undefined,
): { background: string; foreground: string } {
  if (!colorId) return DEFAULT_CALENDAR_COLOR;
  const found = GOOGLE_EVENT_COLORS.find((c) => c.id === colorId);
  return found ?? DEFAULT_CALENDAR_COLOR;
}
