import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

vi.mock("server-only", () => ({}));

const TMP_DB = path.join(os.tmpdir(), `tm-meeting-test-${process.pid}.sqlite`);
process.env.TASK_MAESTRO_DB_PATH = TMP_DB;

import { closeDb } from "@/lib/db/connection";
import {
  upsertMeetingDoc,
  listMeetingDocs,
  markMeetingDocProcessed,
  findMeetingDocById,
} from "@/lib/db/meetingDocRepository";

beforeAll(() => {
  closeDb(); // 既存シングルトンを破棄し、TMP_DB で開き直す
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TMP_DB + suffix);
    } catch {
      // ignore
    }
  }
});

const sample = {
  calendarEventId: "evt-1",
  documentId: "doc-1",
  title: "定例MTG",
  occurredAt: "2026-06-10T01:00:00.000Z",
  docUrl: "https://docs.google.com/document/d/doc-1/edit",
};

describe("meetingDocRepository", () => {
  it("upsert で作成し calendarEventId で一意に更新する", () => {
    const created = upsertMeetingDoc(sample);
    expect(created.id).toBeGreaterThan(0);
    const updated = upsertMeetingDoc({ ...sample, title: "定例MTG(改)" });
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe("定例MTG(改)");
  });

  it("未処理のみを一覧でき、処理済みは除外される", () => {
    const m = upsertMeetingDoc({ ...sample, calendarEventId: "evt-2" });
    expect(listMeetingDocs(false).some((d) => d.id === m.id)).toBe(true);
    markMeetingDocProcessed(m.id);
    expect(listMeetingDocs(false).some((d) => d.id === m.id)).toBe(false);
    expect(findMeetingDocById(m.id)?.processedAt).toBeTruthy();
  });
});
