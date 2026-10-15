"use server";

import crypto from "crypto";
import { getDb } from "@/lib/db";

export interface RecentlyViewedRecord {
  id: string;
  user_id: string;
  product_id: string;
  viewed_at: string;
  products?: {
    id: string;
    name: string;
    photo_url: string | null;
    photo_path: string | null;
  };
}

export async function list(userId: string): Promise<RecentlyViewedRecord[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT 
        rv.id,
        rv.user_id,
        rv.product_id,
        rv.viewed_at,
        p.id AS p_id,
        p.name AS p_name,
        p.photo_path AS p_photo_path
      FROM recently_viewed rv
      JOIN products p ON p.id = rv.product_id
      WHERE rv.user_id = ?
      ORDER BY rv.viewed_at DESC
      LIMIT 20
    `
    )
    .all(userId) as {
    id: string;
    user_id: string;
    product_id: string;
    viewed_at: string;
    p_id: string;
    p_name: string;
    p_photo_path: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    product_id: row.product_id,
    viewed_at: row.viewed_at,
    products: {
      id: row.p_id,
      name: row.p_name,
      photo_path: row.p_photo_path,
      photo_url: row.p_photo_path ? `/api/photos/${row.p_photo_path}` : null,
    },
  }));
}

export async function get(
  id: string,
  userId: string
): Promise<RecentlyViewedRecord | null> {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, user_id, product_id, viewed_at FROM recently_viewed WHERE id = ? AND user_id = ?"
    )
    .get(id, userId) as RecentlyViewedRecord | undefined;

  return row || null;
}

export async function record(
  productId: string,
  userId: string
): Promise<{ success: boolean }> {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare(
      "SELECT id FROM recently_viewed WHERE user_id = ? AND product_id = ?"
    )
    .get(userId, productId) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE recently_viewed SET viewed_at = ? WHERE id = ?"
    ).run(now, existing.id);
  } else {
    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO recently_viewed (id, user_id, product_id, viewed_at) VALUES (?, ?, ?, ?)"
    ).run(id, userId, productId, now);
  }

  return { success: true };
}

export async function create(
  data: { product_id: string },
  userId: string
): Promise<{ success: boolean }> {
  return record(data.product_id, userId);
}

export async function update(
  id: string,
  data: { viewed_at?: string },
  userId: string
): Promise<RecentlyViewedRecord | null> {
  const db = getDb();
  const viewedAt = data.viewed_at || new Date().toISOString();
  db.prepare(
    "UPDATE recently_viewed SET viewed_at = ? WHERE id = ? AND user_id = ?"
  ).run(viewedAt, id, userId);

  return get(id, userId);
}

export async function remove(
  id: string,
  userId: string
): Promise<{ success: boolean }> {
  const db = getDb();
  db.prepare("DELETE FROM recently_viewed WHERE id = ? AND user_id = ?").run(
    id,
    userId
  );
  return { success: true };
}
