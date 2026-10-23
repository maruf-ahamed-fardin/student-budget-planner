import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { pickClientIp } from "./client-ip.js";
import { all, one, run } from "./db.js";

/**
 * Database-backed sessions.
 *
 * The cookie holds 32 random bytes; the database holds only their SHA-256. So a
 * copied `budget.db` cannot be turned into a working login, and signing out (or
 * "sign out everywhere") really ends a session — unlike a stateless JWT, which
 * stays valid until it expires no matter what the server thinks.
 *
 * In production the cookie uses the `__Host-` prefix, which browsers only accept
 * with Secure, Path=/ and no Domain — it cannot be set by a sibling subdomain or
 * over plain HTTP.
 */

const PROD = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = PROD ? "__Host-bbd_session" : "bbd_session";

const DAY = 86_400_000;
const SESSION_TTL = 30 * DAY;
export const DEMO_TTL = DAY;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export async function createSession(userId, { ttl = SESSION_TTL } = {}) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const userAgent = ((await headers()).get("user-agent") ?? "").slice(0, 200);

  run(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    sha256(token),
    userId,
    now + ttl,
    now,
    userAgent,
  );

  // Housekeeping piggybacks on logins rather than needing a cron job.
  run("DELETE FROM sessions WHERE expires_at < ?", now);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // unreachable from JavaScript, so an XSS cannot steal it
    secure: PROD,
    sameSite: "lax", // not sent on cross-site POSTs
    path: "/",
    expires: new Date(now + ttl),
    priority: "high",
  });
}

/**
 * The signed-in user for this request, or null. Wrapped in React `cache`, so
 * the layout and the page share one lookup per request.
 */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const user = one(
    `SELECT u.id, u.email, u.name, u.university, u.is_demo AS isDemo, u.created_at AS createdAt,
            s.expires_at AS sessionExpiresAt
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    sha256(token),
    Date.now(),
  );
  return user && { ...user, isDemo: user.isDemo === 1 };
});

/**
 * Every page and every server action calls this. The proxy's cookie check is
 * only an early redirect for a nicer UX; this is the actual gate, because a
 * server action is just a POST that can be sent to any route by anyone.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", sha256(token));
  store.delete(SESSION_COOKIE);
}

/** Ends every session of `userId` except, optionally, the current one. */
export async function destroyOtherSessions(userId) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const result = run(
    "DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?",
    userId,
    token ? sha256(token) : "",
  );
  return result.changes;
}

export const countSessions = (userId) =>
  one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?", userId, Date.now())
    ?.n ?? 0;

/* ------------------------------------------------------------------ *
 * Rate limiting                                                       *
 * ------------------------------------------------------------------ *
 * A sliding window over the auth_attempts table. It lives in SQLite rather
 * than memory so a restart does not hand an attacker a fresh budget, and it
 * needs no Redis for a single-server app.                               */

/** See client-ip.js for why the *last* trusted hop, not the first entry. */
export async function clientIp() {
  const h = await headers();
  return pickClientIp({
    forwardedFor: h.get("x-forwarded-for"),
    realIp: h.get("x-real-ip"),
    trustedHops: Number(process.env.TRUSTED_PROXY_HOPS ?? 1),
  });
}

export function isRateLimited(key, limit, windowMs) {
  const since = Date.now() - windowMs;
  const row = one("SELECT COUNT(*) AS n FROM auth_attempts WHERE key = ? AND at > ?", key, since);
  return (row?.n ?? 0) >= limit;
}

export function recordAttempt(key) {
  const now = Date.now();
  run("INSERT INTO auth_attempts (key, at) VALUES (?, ?)", key, now);
  // Nothing older than a day is ever consulted.
  run("DELETE FROM auth_attempts WHERE at < ?", now - DAY);
}

export const clearAttempts = (key) => run("DELETE FROM auth_attempts WHERE key = ?", key);

/** Demo accounts are sandboxes; anything older than a day is swept. */
export function sweepExpiredDemos() {
  const stale = all(
    "SELECT id FROM users WHERE is_demo = 1 AND created_at < ?",
    Date.now() - DEMO_TTL,
  );
  for (const { id } of stale) run("DELETE FROM users WHERE id = ?", id);
  return stale.length;
}
