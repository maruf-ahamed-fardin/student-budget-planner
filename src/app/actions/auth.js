"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";

import {
  clearAttempts,
  clientIp,
  createSession,
  DEMO_TTL,
  destroySession,
  isRateLimited,
  recordAttempt,
  sweepExpiredDemos,
} from "@/lib/auth";
import { one, run, transaction } from "@/lib/db";
import { fail, hasErrors, INVALID, isEmail, text } from "@/lib/forms";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { seedSampleData } from "@/lib/sample-data";
import { safeNextPath } from "@/lib/utils";

const MINUTE = 60_000;
const SLOW_DOWN = "Too many attempts. Take a breather and try again in 15 minutes.";

/* ------------------------------------------------------------------ *
 * Sign up                                                             *
 * ------------------------------------------------------------------ */

export async function signup(_prev, formData) {
  const ip = await clientIp();
  if (isRateLimited(`signup:${ip}`, 10, 60 * MINUTE)) return fail(SLOW_DOWN);

  const name = text(formData, "name", 100);
  const email = text(formData, "email", 300).toLowerCase();
  const university = text(formData, "university", 100);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const values = { name, email, university };

  const errors = {};
  if (name.length < 2 || name.length > 60) errors.name = "Between 2 and 60 characters.";
  if (!isEmail(email)) errors.email = "That doesn't look like an email address.";
  if (university.length > 80) errors.university = "Keep it under 80 characters.";
  const problem = passwordProblem(password, { email, name });
  if (problem) errors.password = problem;

  if (hasErrors(errors)) return fail(INVALID, errors, values);

  recordAttempt(`signup:${ip}`);

  if (one("SELECT 1 AS found FROM users WHERE email = ?", email)) {
    return fail(INVALID, { email: "An account with this email already exists. Log in instead?" }, values);
  }

  const passwordHash = await hashPassword(password);
  let userId;
  try {
    userId = Number(
      run(
        `INSERT INTO users (email, name, university, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
        email,
        name,
        university,
        passwordHash,
        Date.now(),
      ).lastInsertRowid,
    );
  } catch (error) {
    // Two sign-ups racing with one email: the check above passed for both
    // (hashing awaits in between), and the UNIQUE index stops the second.
    if (String(error?.message).includes("UNIQUE")) {
      return fail(INVALID, { email: "An account with this email already exists. Log in instead?" }, values);
    }
    throw error;
  }

  await createSession(userId);
  redirect("/dashboard?welcome=1");
}

/* ------------------------------------------------------------------ *
 * Log in                                                              *
 * ------------------------------------------------------------------ */

export async function login(_prev, formData) {
  const email = text(formData, "email", 300).toLowerCase();
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const next = safeNextPath(text(formData, "next", 300));
  const values = { email };

  if (!email || !password) {
    return fail(INVALID, {
      ...(!email && { email: "Enter your email." }),
      ...(!password && { password: "Enter your password." }),
    }, values);
  }

  // Two limits: per IP stops one machine spraying many accounts; per email
  // stops a botnet hammering one account, since it can't rotate the email.
  const ip = await clientIp();
  const ipKey = `login-ip:${ip}`;
  const emailKey = `login-email:${email}`;
  if (isRateLimited(ipKey, 30, 15 * MINUTE) || isRateLimited(emailKey, 6, 15 * MINUTE)) {
    return fail(SLOW_DOWN, undefined, values);
  }

  const user = one("SELECT id, password_hash AS hash FROM users WHERE email = ? AND is_demo = 0", email);
  // Always pay for one scrypt, so response time does not reveal whether the
  // email has an account.
  const ok = await verifyPassword(password, user?.hash ?? (await dummyHash()));

  if (!user || !ok) {
    recordAttempt(ipKey);
    recordAttempt(emailKey);
    // One message for both cases: never confirm which half was wrong.
    return fail("Email or password is incorrect.", undefined, values);
  }

  clearAttempts(emailKey);
  await createSession(user.id);
  redirect(next);
}

/* ------------------------------------------------------------------ *
 * Demo sandbox                                                        *
 * ------------------------------------------------------------------ */

/**
 * Every visitor gets a private, pre-filled account that disappears after a
 * day. Recruiters can add, edit and delete freely without seeing — or
 * wrecking — anyone else's clicks, which a single shared demo login can't
 * promise.
 */
export async function startDemo() {
  const ip = await clientIp();
  const key = `demo:${ip}`;
  if (isRateLimited(key, 8, 60 * MINUTE)) redirect("/login?error=demo-limit");
  recordAttempt(key);

  sweepExpiredDemos();

  const userId = transaction((db) => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO users (email, name, university, password_hash, is_demo, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
      )
      .run(
        `demo-${randomBytes(8).toString("hex")}@demo.invalid`,
        "Demo Student",
        "Uttara University",
        // Not a valid hash format, so no password can ever log into it.
        "!demo",
        Date.now(),
      );
    seedSampleData(db, Number(lastInsertRowid));
    return Number(lastInsertRowid);
  });

  await createSession(userId, { ttl: DEMO_TTL });
  redirect("/dashboard?welcome=demo");
}

/* ------------------------------------------------------------------ *
 * Log out                                                             *
 * ------------------------------------------------------------------ */

export async function logout() {
  await destroySession();
  redirect("/");
}
