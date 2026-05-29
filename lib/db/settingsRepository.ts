import "server-only";
import { getDb } from "./connection";
import { DatabaseError } from "../errors";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../types/settings";

const APP_SETTINGS_KEY = "app";

interface SettingsRow {
  value_json: string;
}

export function getAppSettings(): AppSettings {
  try {
    const db = getDb();
    const row = db
      .prepare<[string], SettingsRow>("SELECT value_json FROM settings WHERE key = ?")
      .get(APP_SETTINGS_KEY);
    if (!row) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(row.value_json) as Partial<AppSettings>;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      ai: { ...DEFAULT_APP_SETTINGS.ai, ...(parsed.ai ?? {}) },
      backlog: { ...DEFAULT_APP_SETTINGS.backlog, ...(parsed.backlog ?? {}) },
      slack: { ...DEFAULT_APP_SETTINGS.slack, ...(parsed.slack ?? {}) },
      statusMapping: parsed.statusMapping ?? DEFAULT_APP_SETTINGS.statusMapping,
      kanban: { ...DEFAULT_APP_SETTINGS.kanban, ...(parsed.kanban ?? {}) },
    };
  } catch (error) {
    throw new DatabaseError("設定の取得に失敗しました", error);
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    ).run(APP_SETTINGS_KEY, JSON.stringify(settings), new Date().toISOString());
  } catch (error) {
    throw new DatabaseError("設定の保存に失敗しました", error);
  }
}
