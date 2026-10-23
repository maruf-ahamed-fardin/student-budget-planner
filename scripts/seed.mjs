/**
 * Development seed:  npm run seed
 *
 * Creates (or resets) a local account filled with six months of sample data,
 * so every page has something to show. Only that account is touched — any
 * other accounts in the database are left alone.
 *
 *   email     student@budgetbd.local
 *   password  printed below (override with SEED_PASSWORD)
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { hashPassword } from "../src/lib/password.js";
import { seedSampleData } from "../src/lib/sample-data.js";
import { migrate } from "../src/lib/schema.js";

const EMAIL = "student@budgetbd.local";
const PASSWORD = process.env.SEED_PASSWORD ?? "rickshaw-and-cha-2026";

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "budget.db");
fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new DatabaseSync(file);
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
migrate(db);

const passwordHash = await hashPassword(PASSWORD);

db.exec("BEGIN IMMEDIATE");
try {
  // Cascades take the old sample's transactions, limits, goals and sessions.
  db.prepare("DELETE FROM users WHERE email = ?").run(EMAIL);
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO users (email, name, university, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(EMAIL, "Rafi Ahmed", "Uttara University", passwordHash, Date.now());

  const { transactions, months } = seedSampleData(db, Number(lastInsertRowid));
  db.exec("COMMIT");

  console.log(`Seeded ${transactions} transactions, ${months[0]} … ${months.at(-1)}`);
  console.log(`  log in with  ${EMAIL}`);
  console.log(`  password     ${PASSWORD}`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
