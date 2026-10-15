import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export function getDataDir(): string {
  const dir = process.env.ELECTRON_DATA_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

declare global {
  // eslint-disable-next-line no-var
  var __dbInstance: Database.Database | undefined;
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      notes TEXT,
      photo_path TEXT,
      has_qr INTEGER DEFAULT 0,
      qr_data TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recently_viewed (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_recently_viewed_user_product
      ON recently_viewed (user_id, product_id);
  `);
}

export function getDb(): Database.Database {
  if (globalThis.__dbInstance) {
    return globalThis.__dbInstance;
  }

  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "inventory.db");
  const db = new Database(dbPath);

  // Enable foreign keys and WAL mode
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  runMigrations(db);

  if (process.env.NODE_ENV !== "production") {
    globalThis.__dbInstance = db;
  }

  return db;
}

export const db = getDb();
export default db;
