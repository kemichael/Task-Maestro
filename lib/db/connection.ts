import "server-only";
import Database, { type Database as DatabaseType } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../logger";
import { DatabaseError } from "../errors";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "task-maestro.sqlite");
const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

declare global {
  // eslint-disable-next-line no-var
  var __taskMaestroDb: DatabaseType | undefined;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function openDatabase(): DatabaseType {
  ensureDir(DB_DIR);
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function applyMigrations(db: DatabaseType) {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    logger.warn({ MIGRATIONS_DIR }, "マイグレーションディレクトリが存在しません");
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db
    .prepare<[], { filename: string }>("SELECT filename FROM migration_history")
    .all();
  const applied = new Set(appliedRows.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    if (applied.has(filename)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO migration_history (filename, applied_at) VALUES (?, ?)",
      ).run(filename, new Date().toISOString());
    });
    try {
      tx();
      logger.info({ filename }, "マイグレーション適用");
    } catch (error) {
      logger.error({ filename, error }, "マイグレーション失敗");
      throw new DatabaseError(`マイグレーション失敗: ${filename}`, error);
    }
  }
}

export function getDb(): DatabaseType {
  if (globalThis.__taskMaestroDb) return globalThis.__taskMaestroDb;
  const db = openDatabase();
  applyMigrations(db);
  globalThis.__taskMaestroDb = db;
  return db;
}

export function closeDb(): void {
  if (globalThis.__taskMaestroDb) {
    globalThis.__taskMaestroDb.close();
    globalThis.__taskMaestroDb = undefined;
  }
}
