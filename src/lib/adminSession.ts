// Shared by the Node.js Proxy and server route handlers.
// Never store the raw admin password or ADMIN_KEY in a browser cookie.
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "kinc_admin_session";
export const LEGACY_ADMIN_COOKIE = "admin_key";
export const SHORT_SESSION_SECONDS = 24 * 60 * 60;
export const LONG_SESSION_SECONDS = 30 * 24 * 60 * 60;

export function getAdminSecret(): string | null {
  const key = process.env.ADMIN_KEY;
  const fallback = process.env.ADMIN_PASSWORD;
  if (key?.trim()) return key;
  if (fallback?.trim()) return fallback;
  return null;
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`kincstarto-admin-session-v1:${payload}`)
    .digest("hex");
}

export function createAdminSession(secret: string, remember: boolean, nowMs = Date.now()) {
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + (remember ? LONG_SESSION_SECONDS : SHORT_SESSION_SECONDS);
  const payload = `v1.${issuedAt}.${expiresAt}`;
  return `${payload}.${signPayload(payload, secret)}`;
}

export function verifyAdminSession(token: string | undefined, secret: string | null, nowMs = Date.now()) {
  if (!secret || !token || token.length > 150) return false;
  const match = /^v1\.(\d{10})\.(\d{10})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const issuedAt = Number(match[1]);
  const expiresAt = Number(match[2]);
  const nowSeconds = Math.floor(nowMs / 1000);
  const duration = expiresAt - issuedAt;
  if (issuedAt > nowSeconds || expiresAt <= nowSeconds || duration <= 0 || duration > LONG_SESSION_SECONDS) {
    return false;
  }
  const payload = `v1.${match[1]}.${match[2]}`;
  const expected = Buffer.from(signPayload(payload, secret), "hex");
  const actual = Buffer.from(match[3], "hex");
  return timingSafeEqual(expected, actual);
}

// Strict same-origin policy for browser mutations. If Origin is absent,
// deny the mutation rather than accepting unverifiable requests.
export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
