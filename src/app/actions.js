"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { getSemester, run } from "@/db";
import {
  categoryLabel,
  formatTaka,
  isIsoDate,
  isIsoMonth,
  isValidCategory,
  MoneyError,
  toPoisha,
} from "@/utils";

/**
 * Every mutation in the app. Each one validates, writes, revalidates, and
 * returns a plain object that `useActionState` renders — `{ status: 'success',
 * message, at }` or `{ status: 'error', message, fieldErrors }`.
 *
 * A 'use server' module may only export async functions, so the helpers and
 * validators below stay private to this file.
 */

/**
 * One transaction changes the numbers on every page: the dashboard totals, the
 * filtered ledger, the budget bars, the charts and the semester matrix all read
 * the same table. Revalidating them together stops a stale figure appearing on
 * whichever page the student opens next.
 */
function revalidateAll() {
  for (const route of ["/", "/transactions", "/budget", "/charts", "/semester"]) {
    revalidatePath(route);
  }
}

const fail = (message, fieldErrors) => ({ status: "error", message, fieldErrors });

/**
 * `at` is a per-result token. Forms use it as a React `key`, so a successful
 * submit remounts the fields — clearing the inputs and their local state in one
 * step instead of resetting them piecemeal from inside an effect.
 */
const succeed = (message) => ({ status: "success", message, at: Date.now() });

const text = (formData, name) => String(formData.get(name) ?? "").trim();

/** Parses money, turning a MoneyError into a field error the student can read. */
function readAmount(formData, name, errors, { optional = false } = {}) {
  const raw = text(formData, name);
  if (optional && raw === "") return 0;

  try {
    return toPoisha(raw);
  } catch (error) {
    errors[name] = error instanceof MoneyError ? error.message : "Invalid amount.";
    return null;
  }
}

const INVALID = "Please fix the highlighted fields.";

/* ------------------------------------------------------------------ *
 * Transactions                                                        *
 * ------------------------------------------------------------------ */

export async function addTransaction(_prev, formData) {
  const errors = {};

  const type = text(formData, "type");
  if (type !== "income" && type !== "expense") {
    errors.type = "Choose income or expense.";
  }

  const amount = readAmount(formData, "amount", errors);

  const category = text(formData, "category");
  if (!category) {
    errors.category = "Choose a category.";
  } else if (!isValidCategory(category, type === "income" ? "income" : "expense")) {
    // Guards against an income category being filed as an expense, which would
    // otherwise total "Family Support" against a spending limit.
    errors.category = "That category doesn't belong to the selected type.";
  }

  const occurredOn = text(formData, "occurredOn");
  if (!isIsoDate(occurredOn)) errors.occurredOn = "Pick a valid date.";

  const description = text(formData, "description");
  if (description.length > 120) {
    errors.description = "Keep the description under 120 characters.";
  }

  if (Object.keys(errors).length > 0) return fail(INVALID, errors);

  run(
    `INSERT INTO transactions (type, amount_poisha, category, description, occurred_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    type,
    amount,
    category,
    description,
    occurredOn,
    Date.now(),
  );

  revalidateAll();
  return succeed(
    `${type === "income" ? "Income" : "Expense"} of ${formatTaka(amount)} added to ${categoryLabel(category)}.`,
  );
}

export async function deleteTransaction(_prev, formData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("That entry no longer exists.");

  const result = run("DELETE FROM transactions WHERE id = ?", id);
  if (result.changes === 0) return fail("That entry no longer exists.");

  revalidateAll();
  return succeed("Transaction deleted.");
}

/* ------------------------------------------------------------------ *
 * Budget limits                                                       *
 * ------------------------------------------------------------------ */

/** Creates the limit, or replaces it if the category already has one. */
export async function setBudgetLimit(_prev, formData) {
  const errors = {};

  const category = text(formData, "category");
  if (!category) {
    errors.category = "Choose a category.";
  } else if (!isValidCategory(category, "expense")) {
    errors.category = "Limits can only be set on expense categories.";
  }

  const limit = readAmount(formData, "limit", errors);

  if (Object.keys(errors).length > 0) return fail(INVALID, errors);

  run(
    `INSERT INTO budget_limits (category, limit_poisha, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT (category) DO UPDATE SET
       limit_poisha = excluded.limit_poisha,
       updated_at   = excluded.updated_at`,
    category,
    limit,
    Date.now(),
  );

  revalidateAll();
  return succeed(`${categoryLabel(category)} limit set to ${formatTaka(limit)} a month.`);
}

export async function removeBudgetLimit(_prev, formData) {
  const category = text(formData, "category");
  if (!category) return fail("That limit no longer exists.");

  const result = run("DELETE FROM budget_limits WHERE category = ?", category);
  if (result.changes === 0) return fail("That limit no longer exists.");

  revalidateAll();
  return succeed(`Limit removed from ${categoryLabel(category)}.`);
}

/* ------------------------------------------------------------------ *
 * Semesters                                                           *
 * ------------------------------------------------------------------ */

export async function createSemester(_prev, formData) {
  const errors = {};

  const name = text(formData, "name");
  if (!name) errors.name = "Give the semester a name.";
  else if (name.length > 60) errors.name = "Keep the name under 60 characters.";

  const startMonth = text(formData, "startMonth");
  if (!isIsoMonth(startMonth)) errors.startMonth = "Pick a valid start month.";

  const months = Number(text(formData, "months"));
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    errors.months = "Between 1 and 12 months.";
  }

  if (Object.keys(errors).length > 0) return fail(INVALID, errors);

  run(
    `INSERT INTO semesters (name, start_month, months, created_at) VALUES (?, ?, ?, ?)`,
    name,
    startMonth,
    months,
    Date.now(),
  );

  revalidateAll();
  return succeed(`${name} added. Its matrix builds itself from your transactions.`);
}

export async function deleteSemester(_prev, formData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("That semester no longer exists.");
  if (!getSemester(id)) return fail("That semester no longer exists.");

  run("DELETE FROM semesters WHERE id = ?", id);

  revalidateAll();
  return succeed("Semester deleted. Your transactions were not touched.");
}

/* ------------------------------------------------------------------ *
 * Theme                                                               *
 * ------------------------------------------------------------------ */

/**
 * The theme lives in a cookie rather than localStorage so the *server* knows it
 * and can stamp `data-theme` on <html> while rendering. That is what removes
 * the flash of the wrong theme on first paint.
 */
export async function setTheme(theme) {
  const store = await cookies();

  store.set("sbp-theme", theme === "dark" ? "dark" : "light", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // The attribute lives on <html>, so the whole layout has to re-render.
  revalidatePath("/", "layout");
}
