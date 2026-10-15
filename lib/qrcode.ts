import QRCode from "qrcode";

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 240,
      margin: 2,
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

export function encodeProductQrPayload(product: {
  id: string;
  name: string;
  notes?: string | null;
}): string {
  return JSON.stringify({
    v: 1,
    id: product.id,
    name: product.name,
    notes: product.notes || "",
  });
}
