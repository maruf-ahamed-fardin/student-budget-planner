import "server-only";

import { all, one } from "./db.js";
import { addMonths, categoryOrder, currentMonth, daysInMonth } from "./utils.js";

/**
 * Every read the app performs. Each function takes the owner's `userId` as its
 * first argument and every statement filters on it — there is no query in the
 * app that can return another student's rows, which is the whole of the
 * authorisation model in one sentence.
 *
 * All grouping and totalling happens here in SQL, so pages render finished
 * numbers and the browser never receives more than it draws.
 */

const TX_COLUMNS = `
  id, type, category, method, description,
  amount_poisha AS amountPoisha,
  occurred_on   AS occurredOn`;

/** Newest first, with created_at as a stable tiebreaker for same-day entries. */
const TX_ORDER = "ORDER BY occurred_on DESC, created_at DESC, id DESC";

const TOTALS = `
  COALESCE(SUM(CASE WHEN type = 'income'  THEN amount_poisha END), 0) AS income,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_poisha END), 0) AS expense`;

/** `[start, end)` date bounds for a run of months — index-friendly, unlike LIKE. */
const bounds = (firstMonth, lastMonth = firstMonth) => [
  `${firstMonth}-01`,
  `${addMonths(lastMonth, 1)}-01`,
];

const shape = (row) => ({
  incomePoisha: row?.income ?? 0,
  expensePoisha: row?.expense ?? 0,
  balancePoisha: (row?.income ?? 0) - (row?.expense ?? 0),
  count: row?.count ?? 0,
});

/* ------------------------------------------------------------------ *
 * Summaries                                                           *
 * ------------------------------------------------------------------ */

/** All-time when `month` is omitted, otherwise scoped to that 'YYYY-MM'. */
export function getSummary(userId, month) {
  if (!month) {
    return shape(
      one(`SELECT ${TOTALS}, COUNT(*) AS count FROM transactions WHERE user_id = ?`, userId),
    );
  }
  return shape(
    one(
      `SELECT ${TOTALS}, COUNT(*) AS count FROM transactions
       WHERE user_id = ? AND occurred_on >= ? AND occurred_on < ?`,
      userId,
      ...bounds(month),
    ),
  );
}

export const getRecentTransactions = (userId, limit = 6) =>
  all(`SELECT ${TX_COLUMNS} FROM transactions WHERE user_id = ? ${TX_ORDER} LIMIT ?`, userId, limit);

export const getTransaction = (userId, id) =>
  one(`SELECT ${TX_COLUMNS} FROM transactions WHERE user_id = ? AND id = ?`, userId, id);

/* ------------------------------------------------------------------ *
 * Ledger                                                              *
 * ------------------------------------------------------------------ */

export const PAGE_SIZE = 25;

/**
 * Filters compose — each one narrows the set further — and the summary is
 * computed over the same WHERE clause, so the totals on screen always describe
 * the rows on screen rather than the whole ledger.
 */
export function getLedger(userId, { type, category, method, month, search } = {}, page = 1) {
  const clauses = ["user_id = ?"];
  const params = [userId];

  if (type) {
    clauses.push("type = ?");
    params.push(type);
  }
  if (category) {
    clauses.push("category = ?");
    params.push(category);
  }
  if (method) {
    clauses.push("method = ?");
    params.push(method);
  }
  if (month) {
    clauses.push("occurred_on >= ? AND occurred_on < ?");
    params.push(...bounds(month));
  }
  if (search) {
    // Escape LIKE wildcards so searching for "50%" looks for a literal "50%".
    const needle = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    clauses.push("(description LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')");
    params.push(needle, needle);
  }

  const where = `WHERE ${clauses.join(" AND ")}`;
  const summary = shape(
    one(`SELECT ${TOTALS}, COUNT(*) AS count FROM transactions ${where}`, ...params),
  );

  const pages = Math.max(1, Math.ceil(summary.count / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);

  const rows = all(
    `SELECT ${TX_COLUMNS} FROM transactions ${where} ${TX_ORDER} LIMIT ? OFFSET ?`,
    ...params,
    PAGE_SIZE,
    (current - 1) * PAGE_SIZE,
  );

  return { rows, summary, page: current, pages };
}

/** Months that contain at least one transaction, newest first. */
export const getActiveMonths = (userId) =>
  all(
    `SELECT DISTINCT substr(occurred_on, 1, 7) AS month
     FROM transactions WHERE user_id = ? ORDER BY month DESC`,
    userId,
  ).map((r) => r.month);

export const getExportRows = (userId) =>
  all(`SELECT ${TX_COLUMNS} FROM transactions WHERE user_id = ? ${TX_ORDER}`, userId);

/* ------------------------------------------------------------------ *
 * Budget                                                              *
 * ------------------------------------------------------------------ */

const spentByCategory = (userId, month) =>
  new Map(
    all(
      `SELECT category, SUM(amount_poisha) AS total
       FROM transactions
       WHERE user_id = ? AND type = 'expense' AND occurred_on >= ? AND occurred_on < ?
       GROUP BY category`,
      userId,
      ...bounds(month),
    ).map((r) => [r.category, r.total]),
  );

/**
 * Spend is never stored — it is summed from the ledger on every read, so the
 * budget page cannot drift out of sync with the transactions behind it.
 */
export function getBudgetOverview(userId, month = currentMonth()) {
  const limits = all(
    `SELECT category, limit_poisha AS limitPoisha FROM budget_limits WHERE user_id = ?`,
    userId,
  );
  const spent = spentByCategory(userId, month);
  const lastSpent = spentByCategory(userId, addMonths(month, -1));

  const rows = limits
    .map(({ category, limitPoisha }) => {
      const spentPoisha = spent.get(category) ?? 0;
      // Uncapped on purpose: a 140% overspend has to read as 140%.
      const percent = (spentPoisha / limitPoisha) * 100;
      return {
        category,
        limitPoisha,
        spentPoisha,
        lastMonthPoisha: lastSpent.get(category) ?? 0,
        remainingPoisha: limitPoisha - spentPoisha,
        percent,
        status: percent >= 100 ? "over" : percent >= 80 ? "warn" : "ok",
      };
    })
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));

  const budgeted = new Set(limits.map((l) => l.category));
  let unbudgetedPoisha = 0;
  for (const [category, total] of spent) {
    if (!budgeted.has(category)) unbudgetedPoisha += total;
  }

  const totalLimitPoisha = rows.reduce((sum, r) => sum + r.limitPoisha, 0);
  const totalSpentPoisha = rows.reduce((sum, r) => sum + r.spentPoisha, 0);

  return {
    month,
    rows,
    totalLimitPoisha,
    totalSpentPoisha,
    /** What is left across every limit, never below zero per category. */
    headroomPoisha: rows.reduce((sum, r) => sum + Math.max(0, r.remainingPoisha), 0),
    /** Spent this month in categories with no limit — easy to miss otherwise. */
    unbudgetedPoisha,
    overCount: rows.filter((r) => r.status === "over").length,
    warnCount: rows.filter((r) => r.status === "warn").length,
  };
}

/* ------------------------------------------------------------------ *
 * Insights + charts                                                   *
 * ------------------------------------------------------------------ */

/** Expense split for a month, in the fixed category order the palette expects. */
export function getCategoryBreakdown(userId, month) {
  const rows = [...spentByCategory(userId, month)]
    .map(([category, poisha]) => ({ category, poisha }))
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));

  const total = rows.reduce((sum, r) => sum + r.poisha, 0);
  return rows.map((r) => ({ ...r, share: total > 0 ? (r.poisha / total) * 100 : 0 }));
}

/**
 * One point per requested month, including months with no activity — a trend
 * chart with gaps silently misrepresents the shape of the semester.
 */
export function getMonthlyTrend(userId, months) {
  if (months.length === 0) return [];

  const grouped = new Map(
    all(
      `SELECT substr(occurred_on, 1, 7) AS month, ${TOTALS}
       FROM transactions
       WHERE user_id = ? AND occurred_on >= ? AND occurred_on < ?
       GROUP BY month`,
      userId,
      ...bounds(months[0], months.at(-1)),
    ).map((r) => [r.month, r]),
  );

  return months.map((month) => ({
    month,
    incomePoisha: grouped.get(month)?.income ?? 0,
    expensePoisha: grouped.get(month)?.expense ?? 0,
  }));
}

/** Expense per calendar day of `month`; index 0 is the 1st. */
export function getDailySpending(userId, month) {
  const days = Array.from({ length: daysInMonth(month) }, () => 0);
  for (const row of all(
    `SELECT CAST(substr(occurred_on, 9, 2) AS INTEGER) AS day, SUM(amount_poisha) AS total
     FROM transactions
     WHERE user_id = ? AND type = 'expense' AND occurred_on >= ? AND occurred_on < ?
     GROUP BY day`,
    userId,
    ...bounds(month),
  )) {
    days[row.day - 1] = row.total;
  }
  return days;
}

export const getMethodBreakdown = (userId, month) =>
  all(
    `SELECT method, SUM(amount_poisha) AS poisha, COUNT(*) AS count
     FROM transactions
     WHERE user_id = ? AND type = 'expense' AND occurred_on >= ? AND occurred_on < ?
     GROUP BY method ORDER BY poisha DESC`,
    userId,
    ...bounds(month),
  );

/** Total spend per weekday (0 = Sunday) across a run of months. */
export function getWeekdayTotals(userId, firstMonth, lastMonth) {
  const totals = Array.from({ length: 7 }, () => 0);
  for (const row of all(
    `SELECT CAST(strftime('%w', occurred_on) AS INTEGER) AS weekday, SUM(amount_poisha) AS total
     FROM transactions
     WHERE user_id = ? AND type = 'expense' AND occurred_on >= ? AND occurred_on < ?
     GROUP BY weekday`,
    userId,
    ...bounds(firstMonth, lastMonth),
  )) {
    totals[row.weekday] = row.total;
  }
  return totals;
}

export const getLargestExpenses = (userId, month, limit = 5) =>
  all(
    `SELECT ${TX_COLUMNS} FROM transactions
     WHERE user_id = ? AND type = 'expense' AND occurred_on >= ? AND occurred_on < ?
     ORDER BY amount_poisha DESC, occurred_on DESC LIMIT ?`,
    userId,
    ...bounds(month),
    limit,
  );

/* ------------------------------------------------------------------ *
 * Goals                                                               *
 * ------------------------------------------------------------------ */

export const getGoals = (userId) =>
  all(
    `SELECT g.id, g.name, g.target_poisha AS targetPoisha, g.deadline, g.created_at AS createdAt,
            COALESCE(SUM(e.amount_poisha), 0) AS savedPoisha,
            COUNT(e.id) AS entries
     FROM goals g LEFT JOIN goal_entries e ON e.goal_id = g.id
     WHERE g.user_id = ?
     GROUP BY g.id
     ORDER BY (g.deadline IS NULL), g.deadline, g.id`,
    userId,
  );

export const getGoal = (userId, id) =>
  one(
    `SELECT g.id, g.name, g.target_poisha AS targetPoisha,
            COALESCE((SELECT SUM(amount_poisha) FROM goal_entries WHERE goal_id = g.id), 0) AS savedPoisha
     FROM goals g WHERE g.user_id = ? AND g.id = ?`,
    userId,
    id,
  );

export const getGoalHistory = (userId, limit = 8) =>
  all(
    `SELECT e.id, e.amount_poisha AS amountPoisha, e.occurred_on AS occurredOn, g.name
     FROM goal_entries e JOIN goals g ON g.id = e.goal_id
     WHERE e.user_id = ?
     ORDER BY e.occurred_on DESC, e.id DESC LIMIT ?`,
    userId,
    limit,
  );

export const getSavedTotal = (userId) =>
  one("SELECT COALESCE(SUM(amount_poisha), 0) AS total FROM goal_entries WHERE user_id = ?", userId)
    ?.total ?? 0;

/* ------------------------------------------------------------------ *
 * Semester                                                            *
 * ------------------------------------------------------------------ */

export const getSemesters = (userId) =>
  all(
    `SELECT id, name, start_month AS startMonth, months
     FROM semesters WHERE user_id = ? ORDER BY start_month DESC, id DESC`,
    userId,
  );

export const getSemester = (userId, id) =>
  one(
    `SELECT id, name, start_month AS startMonth, months FROM semesters WHERE user_id = ? AND id = ?`,
    userId,
    id,
  );

/**
 * The month × category matrix, derived entirely from the ledger — nothing in it
 * is typed in by hand.
 */
export function getSemesterMatrix(userId, months) {
  const expenseTotals = months.map(() => 0);
  const incomeTotals = months.map(() => 0);
  const columnOf = new Map(months.map((m, i) => [m, i]));
  const byCategory = new Map();

  if (months.length > 0) {
    const cells = all(
      `SELECT category, substr(occurred_on, 1, 7) AS month, type, SUM(amount_poisha) AS poisha
       FROM transactions
       WHERE user_id = ? AND occurred_on >= ? AND occurred_on < ?
       GROUP BY category, month, type`,
      userId,
      ...bounds(months[0], months.at(-1)),
    );

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
  }

  const rows = [...byCategory.entries()]
    .map(([category, cells]) => ({
      category,
      cells,
      total: cells.reduce((sum, v) => sum + v, 0),
      peak: Math.max(...cells),
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
