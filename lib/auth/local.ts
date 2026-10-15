"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { getDb, getDataDir } from "@/lib/db";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "./jwt";

export interface AuthUser {
  id: string;
  email: string;
  created_at?: string;
}

export interface AuthSession {
  user: AuthUser;
}

export interface AuthResult {
  user: AuthUser | null;
  session: AuthSession | null;
  data: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
  error: { message: string } | null;
}

function ensureAuthSecret(): void {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim().length > 0) {
    return;
  }
  try {
    const dataDir = getDataDir();
    const secretPath = path.join(dataDir, ".auth-secret");
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, "utf-8").trim();
      if (existing) {
        process.env.AUTH_SECRET = existing;
        return;
      }
    }
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretPath, generated, "utf-8");
    process.env.AUTH_SECRET = generated;
  } catch (err) {
    console.error("Failed to persist .auth-secret:", err);
  }
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function setSessionCookie(user: AuthUser): Promise<void> {
  const token = await createSessionToken({ sub: user.id, email: user.email });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function signUp(
  emailOrObj: string | { email: string; password: string; options?: unknown },
  maybePassword?: string
): Promise<AuthResult> {
  ensureAuthSecret();

  let email = "";
  let password = "";

  if (typeof emailOrObj === "string") {
    email = emailOrObj;
    password = maybePassword || "";
  } else if (emailOrObj && typeof emailOrObj === "object") {
    email = emailOrObj.email || "";
    password = emailOrObj.password || "";
  }

  email = email.trim().toLowerCase();

  if (!email || !validateEmail(email)) {
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: { message: "A valid email address is required" },
    };
  }

  if (!password || password.length < 8) {
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: { message: "Password must be at least 8 characters" },
    };
  }

  const db = getDb();

  // Check if user exists
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email) as { id: string } | undefined;

  if (existing) {
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: { message: "A user with this email already exists" },
    };
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();

  try {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
    ).run(id, email, passwordHash, createdAt);

    const user: AuthUser = { id, email, created_at: createdAt };
    await setSessionCookie(user);

    return {
      user,
      session: { user },
      data: { user, session: { user } },
      error: null,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create account";
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: { message },
    };
  }
}

export async function signIn(
  emailOrObj: string | { email: string; password: string },
  maybePassword?: string
): Promise<AuthResult> {
  ensureAuthSecret();

  let email = "";
  let password = "";

  if (typeof emailOrObj === "string") {
    email = emailOrObj;
    password = maybePassword || "";
  } else if (emailOrObj && typeof emailOrObj === "object") {
    email = emailOrObj.email || "";
    password = emailOrObj.password || "";
  }

  email = email.trim().toLowerCase();

  if (!email || !password) {
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: { message: "Email and password are required" },
    };
  }

  const db = getDb();
  const row = db
    .prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
    .get(email) as
    | {
        id: string;
        email: string;
        password_hash: string;
        created_at: string;
      }
    | undefined;

  if (!row) {
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: { message: "Invalid email or password" },
    };
  }

  const passwordsMatch = await bcrypt.compare(password, row.password_hash);
  if (!passwordsMatch) {
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: { message: "Invalid email or password" },
    };
  }

  const user: AuthUser = {
    id: row.id,
    email: row.email,
    created_at: row.created_at,
  };

  await setSessionCookie(user);

  return {
    user,
    session: { user },
    data: { user, session: { user } },
    error: null,
  };
}

export async function signOut(): Promise<{ error: null }> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return { error: null };
}

export async function getSession(): Promise<AuthResult> {
  ensureAuthSecret();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: null,
    };
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return {
      user: null,
      session: null,
      data: { user: null, session: null },
      error: null,
    };
  }

  const user: AuthUser = {
    id: payload.sub,
    email: payload.email,
  };

  return {
    user,
    session: { user },
    data: { user, session: { user } },
    error: null,
  };
}

export const getUser = getSession;
export const signInWithPassword = signIn;
