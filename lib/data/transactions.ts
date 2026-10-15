"use server";

import { getDb } from "@/lib/db";

export interface TransactionRecord {
  id: string;
  product_id: string;
  user_id: string;
  type: "withdraw" | "add";
  unit_name: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  note: string | null;
  created_at: string;
  product_name?: string;
  current_quantity?: number;
  store_name?: string;
  section_name?: string;
}

export interface ProductSummary {
  product_id: string;
  product_name: string;
  total_withdrawn: number;
  total_added: number;
  current_quantity: number;
  store_name?: string;
  section_name?: string;
  transactions: TransactionRecord[];
}

export async function listByProduct(
  productId: string,
  userId: string,
  limit?: number
): Promise<TransactionRecord[]> {
  const db = getDb();
  let query = `
    SELECT 
      id,
      product_id,
      user_id,
      type,
      unit_name,
      quantity,
      quantity_before,
      quantity_after,
      note,
      created_at
    FROM transactions
    WHERE product_id = ? AND user_id = ?
    ORDER BY created_at DESC
  `;

  const params: unknown[] = [productId, userId];
  if (typeof limit === "number" && limit > 0) {
    query += " LIMIT ?";
    params.push(limit);
  }

  const rows = db.prepare(query).all(...params) as TransactionRecord[];
  return rows;
}

export async function listByDateRange(
  userId: string,
  fromDate: string,
  toDate: string,
  type?: "withdraw" | "add" | "all"
): Promise<TransactionRecord[]> {
  const db = getDb();

  const startIso = fromDate.includes("T") ? fromDate : `${fromDate}T00:00:00.000Z`;
  const endIso = toDate.includes("T") ? toDate : `${toDate}T23:59:59.999Z`;

  let query = `
    SELECT 
      t.id,
      t.product_id,
      t.user_id,
      t.type,
      t.unit_name,
      t.quantity,
      t.quantity_before,
      t.quantity_after,
      t.note,
      t.created_at,
      p.name AS product_name,
      p.quantity AS current_quantity,
      st.name AS store_name,
      sec.name AS section_name
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    LEFT JOIN stores st ON st.id = p.store_id
    LEFT JOIN sections sec ON sec.id = st.section_id
    WHERE t.user_id = ?
      AND t.created_at >= ?
      AND t.created_at <= ?
  `;

  const params: unknown[] = [userId, startIso, endIso];

  if (type === "withdraw" || type === "add") {
    query += " AND t.type = ?";
    params.push(type);
  }

  query += " ORDER BY t.created_at DESC";

  const rows = db.prepare(query).all(...params) as TransactionRecord[];
  return rows;
}

export async function getSummaryByProduct(
  userId: string,
  fromDate: string,
  toDate: string,
  type?: "withdraw" | "add" | "all"
): Promise<ProductSummary[]> {
  const transactions = await listByDateRange(userId, fromDate, toDate, type);

  const productMap = new Map<string, ProductSummary>();

  for (const t of transactions) {
    let summary = productMap.get(t.product_id);
    if (!summary) {
      summary = {
        product_id: t.product_id,
        product_name: t.product_name || "Unknown Product",
        total_withdrawn: 0,
        total_added: 0,
        current_quantity: t.current_quantity ?? 0,
        store_name: t.store_name,
        section_name: t.section_name,
        transactions: [],
      };
      productMap.set(t.product_id, summary);
    }

    if (t.type === "withdraw") {
      summary.total_withdrawn += t.quantity;
    } else if (t.type === "add") {
      summary.total_added += t.quantity;
    }

    summary.transactions.push(t);
  }

  return Array.from(productMap.values());
}
