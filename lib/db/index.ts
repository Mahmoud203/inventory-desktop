import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export function getDataDir(): string {
  const dir = process.env.ELECTRON_DATA_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  }
  return dir;
}

declare global {
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
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('withdraw', 'add')),
      unit_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      quantity_before INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

    CREATE TABLE IF NOT EXISTS recently_viewed (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_recently_viewed_user_product
      ON recently_viewed (user_id, product_id);
  `);

  // Migration for existing databases: check if 'quantity' column exists on products
  const productCols = db.pragma("table_info(products)") as { name: string }[];
  if (productCols.length > 0 && !productCols.some((c) => c.name === "quantity")) {
    db.exec("ALTER TABLE products ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0;");
  }
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
