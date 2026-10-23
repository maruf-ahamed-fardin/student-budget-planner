import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { migrate } from "./schema.js";

/**
 * SQLite through Node's built-in `node:sqlite` — no native build step, no ORM.
 *
 * The connection opens lazily, on the first query. Opening it at import time
 * broke `next build`: several build workers import every page in parallel, and
 * each one racing to switch the file into WAL mode got `database is locked`.
 * Nothing queries during a build (every page is dynamic), so lazy means the
 * build never touches the file at all.
 */

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "budget.db");

function connect() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const database = new DatabaseSync(DB_PATH);
  // Set the timeout before anything that takes a lock, so a second process
  // waits its turn instead of failing immediately.
  database.exec("PRAGMA busy_timeout = 5000");
  // WAL keeps reads from blocking the write a server action just made.
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  database.exec("PRAGMA foreign_keys = ON");
  migrate(database);
  return database;
}

/** Cached on globalThis so dev hot-reloads don't leak a file handle per edit. */
export function getDb() {
  globalThis.__budgetDb ??= connect();
  return globalThis.__budgetDb;
}

/** Rows arrive with a null prototype; spreading gives plain, serialisable objects. */
export const all = (sql, ...params) =>
  getDb()
    .prepare(sql)
    .all(...params)
    .map((row) => ({ ...row }));

export const one = (sql, ...params) => {
  const row = getDb().prepare(sql).get(...params);
  return row === undefined ? null : { ...row };
};

export const run = (sql, ...params) => getDb().prepare(sql).run(...params);

/** Runs `fn` inside a transaction; any throw rolls the whole thing back. */
export function transaction(fn) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
