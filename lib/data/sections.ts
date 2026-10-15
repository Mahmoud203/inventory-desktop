"use server";

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb, getDataDir } from "@/lib/db";

export interface SectionRecord {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  storeCount?: number;
  productCount?: number;
  stores?: { id: string; products: { id: string }[] }[];
}

function deletePhotoFile(photoPath: string | null | undefined): void {
  if (!photoPath || typeof photoPath !== "string") return;
  const cleanPath = photoPath.replace(/^\/?api\/photos\//, "").replace(/^\/+/, "");
  const fullPath = path.join(getDataDir(), "photos", cleanPath);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn("Failed to delete photo file:", fullPath, err);
  }
}

export async function list(userId: string): Promise<SectionRecord[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT 
        s.id,
        s.name,
        s.created_at,
        s.user_id,
        COUNT(DISTINCT st.id) AS store_count,
        COUNT(p.id) AS product_count
      FROM sections s
      LEFT JOIN stores st ON st.section_id = s.id
      LEFT JOIN products p ON p.store_id = st.id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `
    )
    .all(userId) as {
    id: string;
    name: string;
    created_at: string;
    user_id: string;
    store_count: number;
    product_count: number;
  }[];

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    created_at: row.created_at,
    storeCount: Number(row.store_count),
    productCount: Number(row.product_count),
  }));
}

export async function get(
  id: string,
  userId: string
): Promise<SectionRecord | null> {
  const db = getDb();
  const row = db
    .prepare("SELECT id, user_id, name, created_at FROM sections WHERE id = ? AND user_id = ?")
    .get(id, userId) as SectionRecord | undefined;

  return row || null;
}

export async function create(
  data: { name: string },
  userId: string
): Promise<SectionRecord> {
  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    "INSERT INTO sections (id, user_id, name, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, userId, data.name.trim(), createdAt);

  return {
    id,
    user_id: userId,
    name: data.name.trim(),
    created_at: createdAt,
    storeCount: 0,
    productCount: 0,
  };
}

export async function update(
  id: string,
  data: { name: string },
  userId: string
): Promise<SectionRecord | null> {
  const db = getDb();
  db.prepare(
    "UPDATE sections SET name = ? WHERE id = ? AND user_id = ?"
  ).run(data.name.trim(), id, userId);

  return get(id, userId);
}

export async function remove(
  id: string,
  userId: string
): Promise<{ success: boolean }> {
  const db = getDb();

  // Find all stores in this section to delete photo files
  const stores = db
    .prepare("SELECT id FROM stores WHERE section_id = ? AND user_id = ?")
    .all(id, userId) as { id: string }[];

  const storeIds = stores.map((s) => s.id);
  if (storeIds.length > 0) {
    const placeholders = storeIds.map(() => "?").join(",");
    const products = db
      .prepare(
        `SELECT photo_path FROM products WHERE store_id IN (${placeholders}) AND user_id = ?`
      )
      .all(...storeIds, userId) as { photo_path: string | null }[];

    for (const p of products) {
      deletePhotoFile(p.photo_path);
    }
  }

  // Delete section with SQLite foreign key cascade
  db.prepare("DELETE FROM sections WHERE id = ? AND user_id = ?").run(id, userId);
  return { success: true };
}
