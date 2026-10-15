import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "session_token";

export function getJwtSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    "6f855c9fd338d0cebac244e5a84babffdc53ea9e5f6335f546508c8bced128bd";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: {
  sub: string;
  email: string;
}): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      email: (payload.email as string) || "",
    };
  } catch {
    return null;
  }
}
