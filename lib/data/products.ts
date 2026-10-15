"use server";

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb, getDataDir } from "@/lib/db";

export interface ProductRecord {
  id: string;
  store_id: string;
  user_id: string;
  name: string;
  notes: string | null;
  photo_path: string | null;
  photo_url: string | null;
  has_qr: boolean;
  qr_data: string | null;
  created_at: string;
  stores?: {
    id: string;
    name: string;
    section_id: string;
    sections?: {
      id: string;
      name: string;
    };
  };
}

export function deletePhotoFile(photoPath: string | null | undefined): void {
  if (!photoPath || typeof photoPath !== "string") return;
  const cleanPath = photoPath
    .replace(/^\/?api\/photos\//, "")
    .replace(/^\/+/, "");
  const fullPath = path.join(getDataDir(), "photos", cleanPath);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn("Failed to delete photo file:", fullPath, err);
  }
}

function cleanPhotoPath(val: string | null | undefined): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\/?api\/photos\//, "").replace(/^\/+/, "");
}

export async function list(
  userId: string,
  storeId?: string
): Promise<ProductRecord[]> {
  const db = getDb();
  let query = `
    SELECT 
      id,
      store_id,
      user_id,
      name,
      notes,
      photo_path,
      has_qr,
      qr_data,
      created_at
    FROM products
    WHERE user_id = ?
  `;
  const params: unknown[] = [userId];

  if (storeId) {
    query += " AND store_id = ?";
    params.push(storeId);
  }

  query += " ORDER BY created_at DESC";

  const rows = db.prepare(query).all(...params) as {
    id: string;
    store_id: string;
    user_id: string;
    name: string;
    notes: string | null;
    photo_path: string | null;
    has_qr: number;
    qr_data: string | null;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    store_id: row.store_id,
    user_id: row.user_id,
    name: row.name,
    notes: row.notes,
    photo_path: row.photo_path,
    photo_url: row.photo_path ? `/api/photos/${row.photo_path}` : null,
    has_qr: Boolean(row.has_qr),
    qr_data: row.qr_data,
    created_at: row.created_at,
  }));
}

export async function get(
  id: string,
  userId: string
): Promise<ProductRecord | null> {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT 
        p.id,
        p.store_id,
        p.user_id,
        p.name,
        p.notes,
        p.photo_path,
        p.has_qr,
        p.qr_data,
        p.created_at,
        st.id AS store_id_val,
        st.name AS store_name,
        st.section_id AS store_section_id,
        sec.id AS section_id_val,
        sec.name AS section_name
      FROM products p
      LEFT JOIN stores st ON st.id = p.store_id
      LEFT JOIN sections sec ON sec.id = st.section_id
      WHERE p.id = ? AND p.user_id = ?
    `
    )
    .get(id, userId) as
    | {
        id: string;
        store_id: string;
        user_id: string;
        name: string;
        notes: string | null;
        photo_path: string | null;
        has_qr: number;
        qr_data: string | null;
        created_at: string;
        store_id_val: string | null;
        store_name: string | null;
        store_section_id: string | null;
        section_id_val: string | null;
        section_name: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    store_id: row.store_id,
    user_id: row.user_id,
    name: row.name,
    notes: row.notes,
    photo_path: row.photo_path,
    photo_url: row.photo_path ? `/api/photos/${row.photo_path}` : null,
    has_qr: Boolean(row.has_qr),
    qr_data: row.qr_data,
    created_at: row.created_at,
    stores: row.store_id_val
      ? {
          id: row.store_id_val,
          name: row.store_name || "",
          section_id: row.store_section_id || "",
          sections: row.section_id_val
            ? {
                id: row.section_id_val,
                name: row.section_name || "",
              }
            : undefined,
        }
      : undefined,
  };
}

export async function create(
  data: {
    id?: string;
    store_id: string;
    name: string;
    notes?: string | null;
    photo_path?: string | null;
    photo_url?: string | null;
    has_qr?: boolean;
    qr_data?: string | null;
  },
  userId: string
): Promise<ProductRecord> {
  const db = getDb();
  const id = data.id || crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const photoPath = cleanPhotoPath(data.photo_path || data.photo_url);

  db.prepare(
    `
    INSERT INTO products (
      id,
      store_id,
      user_id,
      name,
      notes,
      photo_path,
      has_qr,
      qr_data,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    data.store_id,
    userId,
    data.name.trim(),
    data.notes?.trim() || null,
    photoPath,
    data.has_qr ? 1 : 0,
    data.qr_data || null,
    createdAt
  );

  const product = await get(id, userId);
  return product!;
}

export async function update(
  id: string,
  data: {
    name?: string;
    notes?: string | null;
    photo_path?: string | null;
    photo_url?: string | null;
    has_qr?: boolean;
    qr_data?: string | null;
  },
  userId: string
): Promise<ProductRecord | null> {
  const db = getDb();

  const existing = db
    .prepare("SELECT photo_path FROM products WHERE id = ? AND user_id = ?")
    .get(id, userId) as { photo_path: string | null } | undefined;

  if (!existing) return null;

  const newPhotoPath =
    data.photo_path !== undefined || data.photo_url !== undefined
      ? cleanPhotoPath(data.photo_path || data.photo_url)
      : existing.photo_path;

  // If photo was changed or removed, delete previous photo file
  if (
    existing.photo_path &&
    newPhotoPath !== existing.photo_path
  ) {
    deletePhotoFile(existing.photo_path);
  }

  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    params.push(data.name.trim());
  }
  if (data.notes !== undefined) {
    fields.push("notes = ?");
    params.push(data.notes ? data.notes.trim() : null);
  }
  if (data.photo_path !== undefined || data.photo_url !== undefined) {
    fields.push("photo_path = ?");
    params.push(newPhotoPath);
  }
  if (data.has_qr !== undefined) {
    fields.push("has_qr = ?");
    params.push(data.has_qr ? 1 : 0);
  }
  if (data.qr_data !== undefined) {
    fields.push("qr_data = ?");
    params.push(data.qr_data);
  }

  if (fields.length > 0) {
    params.push(id, userId);
    db.prepare(
      `UPDATE products SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`
    ).run(...params);
  }

  return get(id, userId);
}

export async function remove(
  id: string,
  userId: string
): Promise<{ success: boolean }> {
  const db = getDb();

  const product = db
    .prepare("SELECT photo_path FROM products WHERE id = ? AND user_id = ?")
    .get(id, userId) as { photo_path: string | null } | undefined;

  if (product && product.photo_path) {
    deletePhotoFile(product.photo_path);
  }

  db.prepare("DELETE FROM products WHERE id = ? AND user_id = ?").run(
    id,
    userId
  );

  return { success: true };
}

export async function search(
  query: string,
  userId: string
): Promise<ProductRecord[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT 
        p.id,
        p.name,
        p.photo_path,
        p.store_id,
        st.id AS store_id_val,
        st.name AS store_name,
        st.section_id AS store_section_id,
        sec.id AS section_id_val,
        sec.name AS section_name
      FROM products p
      LEFT JOIN stores st ON st.id = p.store_id
      LEFT JOIN sections sec ON sec.id = st.section_id
      WHERE p.user_id = ? AND p.name LIKE ?
      LIMIT 8
    `
    )
    .all(userId, `%${trimmed}%`) as {
    id: string;
    name: string;
    photo_path: string | null;
    store_id: string;
    store_id_val: string | null;
    store_name: string | null;
    store_section_id: string | null;
    section_id_val: string | null;
    section_name: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    photo_path: row.photo_path,
    photo_url: row.photo_path ? `/api/photos/${row.photo_path}` : null,
    store_id: row.store_id,
    user_id: userId,
    notes: null,
    has_qr: false,
    qr_data: null,
    created_at: "",
    stores: row.store_id_val
      ? {
          id: row.store_id_val,
          name: row.store_name || "",
          section_id: row.store_section_id || "",
          sections: row.section_id_val
            ? {
                id: row.section_id_val,
                name: row.section_name || "",
              }
            : undefined,
        }
      : undefined,
  }));
}
