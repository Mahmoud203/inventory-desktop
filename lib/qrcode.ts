import QRCode from "qrcode";

export interface ProductQrPayloadInput {
  name: string;
  notes?: string | null;
  quantity?: number | null;
  storeName?: string | null;
  sectionName?: string | null;
}

/**
 * Builds the bold, readable plain-text QR payload in Arabic for phone scanning:
 *
 * 📦 {اسم الصنف}
 * ━━━━━━━━━━━━━━━━━
 * 📝 {الوصف}
 * الكمية: {الكمية} وحدة
 * المخزن: {اسم المخزن}
 * القسم: {اسم القسم}
 */
export function formatProductQrPayload(product: ProductQrPayloadInput): string {
  function buildText(notesLimit: number): string {
    const parts: string[] = [];
    const name = (product.name || "").trim();
    parts.push(`📦 ${name}`);
    parts.push("\u2501".repeat(17));

    const rawNotes = (product.notes || "").trim();
    if (rawNotes) {
      let noteText = rawNotes;
      if (noteText.length > notesLimit) {
        noteText = noteText.slice(0, notesLimit).trim() + "...";
      }
      parts.push(`📝 ${noteText}`);
    }

    const qty =
      product.quantity !== undefined && product.quantity !== null
        ? product.quantity
        : 0;
    parts.push(`الكمية: ${qty} وحدة`);

    if (product.storeName && product.storeName.trim()) {
      parts.push(`المخزن: ${product.storeName.trim()}`);
    }

    if (product.sectionName && product.sectionName.trim()) {
      parts.push(`القسم: ${product.sectionName.trim()}`);
    }

    return "\u200F" + parts.join("\n");
  }

  let result = buildText(180);
  if (result.length > 500) {
    result = buildText(150);
  }
  if (result.length > 500) {
    result = result.slice(0, 497) + "...";
  }

  return result;
}

export function encodeProductQrPayload(product: {
  id?: string;
  name: string;
  notes?: string | null;
  quantity?: number | null;
  storeName?: string | null;
  sectionName?: string | null;
}): string {
  return formatProductQrPayload(product);
}

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#171717",
        light: "#FFFFFF",
      },
    });
  } catch (err) {
    console.error("Failed to generate QR Code", err);
    throw err;
  }
}

