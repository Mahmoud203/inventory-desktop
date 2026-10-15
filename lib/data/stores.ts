"use server";

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb, getDataDir } from "@/lib/db";

export interface StoreRecord {
  id: string;
  section_id: string;
  user_id: string;
  name: string;
  created_at: string;
  productCount?: number;
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

export async function list(
  userId: string,
  sectionId?: string
): Promise<StoreRecord[]> {
  const db = getDb();
  let query = `
    SELECT 
      st.id,
      st.section_id,
      st.user_id,
      st.name,
      st.created_at,
      COUNT(p.id) AS product_count
    FROM stores st
    LEFT JOIN products p ON p.store_id = st.id
    WHERE st.user_id = ?
  `;
  const params: unknown[] = [userId];

  if (sectionId) {
    query += " AND st.section_id = ?";
    params.push(sectionId);
  }

  query += " GROUP BY st.id ORDER BY st.created_at DESC";

  const rows = db.prepare(query).all(...params) as {
    id: string;
    section_id: string;
    user_id: string;
    name: string;
    created_at: string;
    product_count: number;
  }[];

  return rows.map((row) => ({
    id: row.id,
    section_id: row.section_id,
    user_id: row.user_id,
    name: row.name,
    created_at: row.created_at,
    productCount: Number(row.product_count),
  }));
}

export async function get(
  id: string,
  userId: string
): Promise<StoreRecord | null> {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, section_id, user_id, name, created_at FROM stores WHERE id = ? AND user_id = ?"
    )
    .get(id, userId) as StoreRecord | undefined;

  return row || null;
}

export async function create(
  data: { name: string; section_id: string },
  userId: string
): Promise<StoreRecord> {
  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    "INSERT INTO stores (id, section_id, user_id, name, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, data.section_id, userId, data.name.trim(), createdAt);

  return {
    id,
    section_id: data.section_id,
    user_id: userId,
    name: data.name.trim(),
    created_at: createdAt,
    productCount: 0,
  };
}

export async function update(
  id: string,
  data: { name: string },
  userId: string
): Promise<StoreRecord | null> {
  const db = getDb();
  db.prepare("UPDATE stores SET name = ? WHERE id = ? AND user_id = ?").run(
    data.name.trim(),
    id,
    userId
  );

  return get(id, userId);
}

export async function remove(
  id: string,
  userId: string
): Promise<{ success: boolean }> {
  const db = getDb();

  // Find all products in this store and delete photo files
  const products = db
    .prepare("SELECT photo_path FROM products WHERE store_id = ? AND user_id = ?")
    .all(id, userId) as { photo_path: string | null }[];

  for (const p of products) {
    deletePhotoFile(p.photo_path);
  }

  // Delete store record (cascades to products and recently_viewed in DB)
  db.prepare("DELETE FROM stores WHERE id = ? AND user_id = ?").run(id, userId);
  return { success: true };
}
