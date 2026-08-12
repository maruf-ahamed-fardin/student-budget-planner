import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SCHEMA } from "@/schema";
import { addMonths, currentMonth } from "@/utils";

/**
 * SQLite through Node's built-in `node:sqlite` — no native build step, no ORM.
 * This module owns the connection and every read the app performs, so pages
 * just call a function and render. All aggregation happens here in SQL on the
 * server, which is why the HTML arrives with the real numbers already in it.
 */

function connect() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });

  const database = new DatabaseSync(path.join(dir, "budget.db"));
  // WAL keeps reads from blocking the write a server action just made.
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec(SCHEMA);
  return database;
}

// Cached on globalThis: Next re-evaluates modules on every hot reload, and
// without this each edit would open (and leak) another file handle.
globalThis.__budgetDb ??= connect();
const db = globalThis.__budgetDb;

/** Rows arrive with a null prototype; spreading gives plain objects. */
const all = (sql, ...params) =>
  db
    .prepare(sql)
    .all(...params)
    .map((row) => ({ ...row }));

const one = (sql, ...params) => {
  const row = db.prepare(sql).get(...params);
  return row === undefined ? null : { ...row };
};

export const run = (sql, ...params) => db.prepare(sql).run(...params);

const TX_COLUMNS = `
  id, type, category, description,
  amount_poisha AS amountPoisha,
  occurred_on   AS occurredOn`;

/** Newest first, with created_at as a stable tiebreaker for same-day entries. */
const TX_ORDER = "ORDER BY occurred_on DESC, created_at DESC, id DESC";

/* ------------------------------------------------------------------ *
 * Totals                                                              *
 * ------------------------------------------------------------------ */

const TOTALS = `
  SUM(CASE WHEN type = 'income'  THEN amount_poisha ELSE 0 END) AS income,
  SUM(CASE WHEN type = 'expense' THEN amount_poisha ELSE 0 END) AS expense`;

/** All-time when `month` is omitted, otherwise scoped to that 'YYYY-MM'. */
export function getSummary(month) {
  const where = month ? "WHERE occurred_on LIKE ?" : "";
  const params = month ? [`${month}%`] : [];

  const row = one(
    `SELECT ${TOTALS}, COUNT(*) AS count FROM transactions ${where}`,
    ...params,
  );

  const incomePoisha = row?.income ?? 0;
  const expensePoisha = row?.expense ?? 0;

  return {
    incomePoisha,
    expensePoisha,
    balancePoisha: incomePoisha - expensePoisha,
    count: row?.count ?? 0,
  };
}

export const getRecentTransactions = (limit = 5) =>
  all(`SELECT ${TX_COLUMNS} FROM transactions ${TX_ORDER} LIMIT ?`, limit);

/* ------------------------------------------------------------------ *
 * Transactions page                                                   *
 * ------------------------------------------------------------------ */

/**
 * Filters compose — each one narrows the set further — and the summary is
 * computed over the same WHERE clause, so the totals on screen always describe
 * the rows on screen rather than the whole ledger.
 */
export function getFilteredTransactions({ type, category, month, search } = {}) {
  const clauses = [];
  const params = [];

  if (type) {
    clauses.push("type = ?");
    params.push(type);
  }
  if (category) {
    clauses.push("category = ?");
    params.push(category);
  }
  if (month) {
    clauses.push("occurred_on LIKE ?");
    params.push(`${month}%`);
  }
  if (search) {
    // Escape LIKE wildcards so searching for "50%" looks for a literal "50%".
    const needle = search.replace(/[\\%_]/g, "\\$&");
    clauses.push("(description LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')");
    params.push(`%${needle}%`, `%${needle}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = all(
    `SELECT ${TX_COLUMNS} FROM transactions ${where} ${TX_ORDER}`,
    ...params,
  );
  const totals = one(`SELECT ${TOTALS} FROM transactions ${where}`, ...params);

  const incomePoisha = totals?.income ?? 0;
  const expensePoisha = totals?.expense ?? 0;

  return {
    rows,
    summary: {
      incomePoisha,
      expensePoisha,
      balancePoisha: incomePoisha - expensePoisha,
      count: rows.length,
    },
  };
}

/** Months that contain at least one transaction, newest first. */
export const getActiveMonths = () =>
  all(
    `SELECT DISTINCT substr(occurred_on, 1, 7) AS month
     FROM transactions ORDER BY month DESC`,
  ).map((r) => r.month);

/* ------------------------------------------------------------------ *
 * Budget page                                                         *
 * ------------------------------------------------------------------ */

/**
 * Spend is never stored — it is summed from the ledger on every read, so the
 * budget page cannot drift out of sync with the transactions behind it.
 */
export function getBudgetOverview(month = currentMonth()) {
  const limits = all(
    `SELECT category, limit_poisha AS limitPoisha FROM budget_limits ORDER BY category`,
  );

  const spent = new Map(
    all(
      `SELECT category, SUM(amount_poisha) AS total
       FROM transactions
       WHERE type = 'expense' AND occurred_on LIKE ?
       GROUP BY category`,
      `${month}%`,
    ).map((r) => [r.category, r.total]),
  );

  const rows = limits.map(({ category, limitPoisha }) => {
    const spentPoisha = spent.get(category) ?? 0;
    // Uncapped on purpose: a 140% overspend has to read as 140%.
    const percent = (spentPoisha / limitPoisha) * 100;

    return {
      category,
      limitPoisha,
      spentPoisha,
      remainingPoisha: limitPoisha - spentPoisha,
      percent,
      status: percent >= 100 ? "over" : percent >= 80 ? "warn" : "ok",
    };
  });

  const budgeted = new Set(limits.map((l) => l.category));
  let unbudgetedPoisha = 0;
  for (const [category, total] of spent) {
    if (!budgeted.has(category)) unbudgetedPoisha += total;
  }

  return {
    month,
    rows,
    totalLimitPoisha: rows.reduce((sum, r) => sum + r.limitPoisha, 0),
    totalSpentPoisha: rows.reduce((sum, r) => sum + r.spentPoisha, 0),
    /** Spent this month in categories with no limit — easy to miss otherwise. */
    unbudgetedPoisha,
    overCount: rows.filter((r) => r.status === "over").length,
  };
}

/* ------------------------------------------------------------------ *
 * Charts page                                                         *
 * ------------------------------------------------------------------ */

export function getCategoryBreakdown(month) {
  const rows = all(
    `SELECT category, SUM(amount_poisha) AS poisha
     FROM transactions
     WHERE type = 'expense' AND occurred_on LIKE ?
     GROUP BY category ORDER BY poisha DESC`,
    `${month}%`,
  );

  const total = rows.reduce((sum, r) => sum + r.poisha, 0);
  return rows.map((r) => ({ ...r, share: total > 0 ? (r.poisha / total) * 100 : 0 }));
}

/**
 * One point per requested month, including months with no activity — a trend
 * chart with gaps silently misrepresents the shape of the semester.
 */
export function getMonthlyTrend(months) {
  if (months.length === 0) return [];

  const grouped = new Map(
    all(
      `SELECT substr(occurred_on, 1, 7) AS month, ${TOTALS}
       FROM transactions
       WHERE occurred_on >= ? AND occurred_on < ?
       GROUP BY month`,
      `${months[0]}-01`,
      `${addMonths(months[months.length - 1], 1)}-01`,
    ).map((r) => [r.month, r]),
  );

  return months.map((month) => ({
    month,
    incomePoisha: grouped.get(month)?.income ?? 0,
    expensePoisha: grouped.get(month)?.expense ?? 0,
  }));
}

/* ------------------------------------------------------------------ *
 * Semester page                                                       *
 * ------------------------------------------------------------------ */

export const getSemesters = () =>
  all(
    `SELECT id, name, start_month AS startMonth, months
     FROM semesters ORDER BY start_month DESC, id DESC`,
  );

export const getSemester = (id) =>
  one(
    `SELECT id, name, start_month AS startMonth, months FROM semesters WHERE id = ?`,
    id,
  );

/**
 * The month × category matrix from page 05 of the mockup, derived entirely
 * from the ledger — nothing in it is typed in by hand.
 */
export function getSemesterMatrix(months) {
  const expenseTotals = months.map(() => 0);
  const incomeTotals = months.map(() => 0);

  if (months.length === 0) {
    return {
      months,
      rows: [],
      expenseTotals,
      incomeTotals,
      balances: [],
      grandExpense: 0,
      grandIncome: 0,
      grandBalance: 0,
    };
  }

  const columnOf = new Map(months.map((m, i) => [m, i]));

  const cells = all(
    `SELECT category, substr(occurred_on, 1, 7) AS month, type,
            SUM(amount_poisha) AS poisha
     FROM transactions
     WHERE occurred_on >= ? AND occurred_on < ?
     GROUP BY category, month, type`,
    `${months[0]}-01`,
    `${addMonths(months[months.length - 1], 1)}-01`,
  );

  const byCategory = new Map();

  for (const cell of cells) {
    const column = columnOf.get(cell.month);
    if (column === undefined) continue;

    if (cell.type === "income") {
      incomeTotals[column] += cell.poisha;
      continue;
    }

    let row = byCategory.get(cell.category);
    if (!row) {
      row = months.map(() => 0);
      byCategory.set(cell.category, row);
    }
    row[column] += cell.poisha;
    expenseTotals[column] += cell.poisha;
  }

  const rows = [...byCategory.entries()]
    .map(([category, values]) => ({
      category,
      cells: values,
      total: values.reduce((sum, v) => sum + v, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const grandExpense = expenseTotals.reduce((s, v) => s + v, 0);
  const grandIncome = incomeTotals.reduce((s, v) => s + v, 0);

  return {
    months,
    rows,
    expenseTotals,
    incomeTotals,
    balances: months.map((_, i) => incomeTotals[i] - expenseTotals[i]),
    grandExpense,
    grandIncome,
    grandBalance: grandIncome - grandExpense,
  };
}
