/**
 * The database schema and its migrations.
 *
 * Kept in its own file with no imports so both the app (src/lib/db.js) and the
 * standalone seed script share one copy of the DDL — duplicated CREATE TABLE
 * statements are how a seed quietly drifts from the real schema.
 *
 * CHECK constraints are the last line of defence: even if a bug slipped past
 * form validation, the database refuses a negative amount, an unknown type or a
 * malformed date. Money columns hold integer poisha (1 Taka = 100 poisha).
 *
 * Every row of user data carries `user_id` with ON DELETE CASCADE, so deleting
 * an account removes everything it owned in one statement.
 */

const V1 = /* sql */ `
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 254),
  name          TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  university    TEXT    NOT NULL DEFAULT '' CHECK (length(university) <= 80),
  password_hash TEXT    NOT NULL,
  is_demo       INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at    INTEGER NOT NULL
);

-- Only a SHA-256 of the session token is stored: a leaked database file
-- cannot be replayed as a logged-in cookie.
CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  user_agent TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

-- Sliding-window rate limiting for login, signup and demo creation.
CREATE TABLE auth_attempts (
  key TEXT    NOT NULL,
  at  INTEGER NOT NULL
);
CREATE INDEX idx_attempts ON auth_attempts (key, at);

CREATE TABLE transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type          TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  amount_poisha INTEGER NOT NULL CHECK (amount_poisha > 0),
  category      TEXT    NOT NULL CHECK (length(category) BETWEEN 1 AND 60),
  method        TEXT    NOT NULL DEFAULT 'cash'
                CHECK (method IN ('cash', 'bkash', 'nagad', 'rocket', 'card', 'bank')),
  description   TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 120),
  occurred_on   TEXT    NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_tx_user_date ON transactions (user_id, occurred_on DESC, id DESC);
CREATE INDEX idx_tx_user_cat  ON transactions (user_id, category);

CREATE TABLE budget_limits (
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category     TEXT    NOT NULL,
  limit_poisha INTEGER NOT NULL CHECK (limit_poisha > 0),
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, category)
);

CREATE TABLE semesters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  start_month TEXT    NOT NULL CHECK (start_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  months      INTEGER NOT NULL CHECK (months BETWEEN 1 AND 12),
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_semesters_user ON semesters (user_id);

CREATE TABLE goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name          TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  target_poisha INTEGER NOT NULL CHECK (target_poisha > 0),
  deadline      TEXT    CHECK (deadline IS NULL OR deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_goals_user ON goals (user_id);

-- Deposits are positive, withdrawals negative. The saved amount is always
-- summed from here, never stored, so it cannot drift from its history.
CREATE TABLE goal_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id       INTEGER NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_poisha INTEGER NOT NULL CHECK (amount_poisha <> 0),
  occurred_on   TEXT    NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_goal_entries_goal ON goal_entries (goal_id);
`;

/**
 * Ordered migrations; `PRAGMA user_version` records how many have run.
 * Append only — never edit one that has shipped.
 */
const MIGRATIONS = [
  (db) => {
    // The single-user prototype had transactions/budget_limits/semesters with
    // no owner. They are renamed rather than dropped: nobody's data is ever
    // deleted by a migration.
    const legacy = ["transactions", "budget_limits", "semesters"].filter(
      (name) =>
        db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name),
    );
    for (const name of legacy) db.exec(`ALTER TABLE ${name} RENAME TO legacy_${name}`);
    for (const name of legacy) {
      // Old indexes keep their names after a rename and would collide.
      for (const { name: index } of db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL")
        .all(`legacy_${name}`)) {
        db.exec(`DROP INDEX ${index}`);
      }
    }
    db.exec(V1);
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Brings any database up to the current schema, atomically per step. */
export function migrate(db) {
  let version = db.prepare("PRAGMA user_version").get().user_version;

  while (version < MIGRATIONS.length) {
    db.exec("BEGIN IMMEDIATE");
    try {
      // Re-read inside the write lock: another process may have just migrated.
      version = db.prepare("PRAGMA user_version").get().user_version;
      if (version < MIGRATIONS.length) {
        MIGRATIONS[version](db);
        db.exec(`PRAGMA user_version = ${version + 1}`);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    version = db.prepare("PRAGMA user_version").get().user_version;
  }
}
