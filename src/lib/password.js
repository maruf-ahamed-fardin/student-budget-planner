import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt from Node's standard library — memory-hard, so
 * a stolen database is expensive to brute-force on a GPU, and no native
 * dependency (bcrypt/argon2) to compile on a student's Windows laptop.
 *
 * The parameters are stored inside each hash, so they can be raised later
 * without invalidating existing accounts: old hashes keep verifying with the
 * cost they were made with.
 *
 * Kept free of `server-only` and the `@/` alias so `node --test` can load it.
 */

const COST = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function scrypt(password, salt, { N, r, p }) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { N, r, p, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** → "scrypt$32768$8$1$<salt b64>$<hash b64>" */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");

  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });

  // Constant-time: a byte-by-byte early exit would leak how much matched.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * A real hash of a random password, verified against when the email does not
 * exist. Without it, "no such user" answers in ~0ms and "wrong password" in
 * ~80ms, and that difference tells an attacker which emails have accounts.
 */
let dummy;
export async function dummyHash() {
  dummy ??= await hashPassword(randomBytes(12).toString("hex"));
  return dummy;
}

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/** Field-level message, or null when the password is acceptable. */
export function passwordProblem(password, { email = "", name = "" } = {}) {
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  // scrypt would happily hash a megabyte; this stops a cheap CPU-burn request.
  if (password.length > MAX_LENGTH) return `Keep it under ${MAX_LENGTH} characters.`;

  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(password) || COMMON.has(lower)) {
    return "That password is on every hacker's first-try list. Pick another.";
  }
  const local = email.split("@")[0].toLowerCase();
  if ((local.length >= 4 && lower.includes(local)) || (name && lower === name.toLowerCase())) {
    return "Don't build the password from your name or email.";
  }
  return null;
}

const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwertyuiop", "qwerty123", "iloveyou", "bangladesh", "bangladesh1", "11111111",
  "abcd1234", "asdfghjkl", "letmein1", "admin123", "welcome1", "00000000",
]);
