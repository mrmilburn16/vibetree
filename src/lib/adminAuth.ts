import { cookies } from "next/headers";

const ADMIN_COOKIE = "vibetree_admin_session";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24; // 24h

/**
 * Get client IP from request headers (Vercel/proxy).
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return null;
}

/**
 * Check if the request IP is in the allowlist.
 * ADMIN_ALLOWED_IPS: comma-separated, e.g. "1.2.3.4,5.6.7.8". If unset, allow all (dev).
 */
export function isAllowedIp(request: Request): boolean {
  const allowed = process.env.ADMIN_ALLOWED_IPS;
  if (!allowed) return true; // dev: no list = allow all
  const ip = getClientIp(request);
  if (!ip) return false;
  const list = allowed.split(",").map((s) => s.trim());
  return list.includes(ip);
}

/**
 * Create a simple signed token (exp + signature).
 */
async function signToken(): Promise<string> {
  const secret = process.env.ADMIN_SECRET || "dev-secret-change-me";
  const exp = Date.now() + ADMIN_COOKIE_MAX_AGE * 1000;
  const payload = `${exp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const sigB64 = Buffer.from(sig).toString("base64url").slice(0, 32);
  return `${sigB64}.${exp}`;
}

async function verifyToken(token: string): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET || "dev-secret-change-me";
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const exp = parseInt(parts[1], 10);
  if (Number.isNaN(exp) || exp < Date.now()) return false;
  const payload = `${exp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const expected = Buffer.from(sig).toString("base64url").slice(0, 32);
  return parts[0] === expected;
}

export async function createAdminSession(): Promise<string> {
  return signToken();
}

/** When true, admin routes are open without secret (local dev only). */
export const ADMIN_DEV_BYPASS =
  process.env.NODE_ENV === "development" &&
  (process.env.ADMIN_DEV_BYPASS !== "0" && process.env.ADMIN_DEV_BYPASS !== "false");

export async function getAdminSession(): Promise<string | null> {
  if (ADMIN_DEV_BYPASS) return "dev-bypass";
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyToken(token))) return null;
  return token;
}

export async function setAdminCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearAdminCookie(): Promise<void> {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}

export { ADMIN_COOKIE_MAX_AGE };
