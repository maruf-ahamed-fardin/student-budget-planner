/**
 * The database schema, applied idempotently on every connection.
 *
 * Kept in its own file with no imports so both the app (src/db.js) and the
 * standalone seed script (scripts/seed.mjs) can share one copy of the DDL —
 * duplicated CREATE TABLE statements are how a seed quietly drifts from the
 * real schema.
 *
 * CHECK constraints are the last line of defence: even if a bug slipped past
 * form validation, the database refuses a negative amount, an unknown type or a
 * malformed date. Money columns hold integer poisha (1 Taka = 100 poisha).
 */
export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  amount_poisha INTEGER NOT NULL CHECK (amount_poisha > 0),
  category      TEXT    NOT NULL CHECK (length(category) BETWEEN 1 AND 60),
  description   TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 120),
  occurred_on   TEXT    NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_date     ON transactions (occurred_on DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category);

CREATE TABLE IF NOT EXISTS budget_limits (
  category     TEXT    PRIMARY KEY,
  limit_poisha INTEGER NOT NULL CHECK (limit_poisha > 0),
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS semesters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  start_month TEXT    NOT NULL CHECK (start_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  months      INTEGER NOT NULL CHECK (months BETWEEN 1 AND 12),
  created_at  INTEGER NOT NULL
);
`;
