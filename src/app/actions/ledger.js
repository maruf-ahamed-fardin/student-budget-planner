"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { run } from "@/lib/db";
import { fail, hasErrors, INVALID, positiveInt, readAmount, succeed, text } from "@/lib/forms";
import { getGoal, getSavedTotal, getSemester, getSummary } from "@/lib/queries";
import {
  categoryLabel,
  formatTaka,
  isIsoDate,
  isIsoMonth,
  isValidCategory,
  isValidMethod,
  today,
} from "@/lib/utils";

/**
 * Every mutation of a student's money. Each action:
 *   1. resolves the signed-in user (requireUser redirects if there is none),
 *   2. validates every field on the server — the browser's checks are a
 *      courtesy, not a defence,
 *   3. writes with `user_id = ?` in the WHERE clause, so an id belonging to
 *      someone else simply matches nothing,
 *   4. revalidates and returns a result for the form to render.
 *
 * Next.js additionally rejects server-action POSTs whose Origin does not match
 * the host, which is the CSRF protection for all of these.
 */

/** One entry moves the numbers on every page, so the whole app revalidates. */
const refreshAll = () => revalidatePath("/", "layout");

/* ------------------------------------------------------------------ *
 * Transactions                                                        *
 * ------------------------------------------------------------------ */

function readTransaction(formData) {
  const errors = {};

  const type = text(formData, "type");
  if (type !== "income" && type !== "expense") errors.type = "Choose income or expense.";

  const amount = readAmount(formData, "amount", errors);

  const category = text(formData, "category", 60);
  if (!category) errors.category = "Choose a category.";
  else if (!isValidCategory(category, type === "income" ? "income" : "expense")) {
    // Stops "Family Support" being filed as an expense and totalled against a limit.
    errors.category = "That category doesn't belong to the selected type.";
  }

  const method = text(formData, "method", 20) || "cash";
  if (!isValidMethod(method)) errors.method = "Choose how you paid.";

  const occurredOn = text(formData, "occurredOn", 10);
  if (!isIsoDate(occurredOn)) errors.occurredOn = "Pick a valid date.";
  else if (occurredOn > today()) errors.occurredOn = "That date hasn't happened yet.";

  const description = text(formData, "description", 200);
  if (description.length > 120) errors.description = "Keep it under 120 characters.";

  const values = {
    type,
    amount: text(formData, "amount", 30),
    category,
    method,
    occurredOn,
    description,
  };

  return { errors, values, data: { type, amount, category, method, occurredOn, description } };
}

export async function saveTransaction(_prev, formData) {
  const user = await requireUser();
  const id = positiveInt(formData, "id");
  const { errors, values, data } = readTransaction(formData);

  if (hasErrors(errors)) return fail(INVALID, errors, values);

  if (id) {
    const result = run(
      `UPDATE transactions
       SET type = ?, amount_poisha = ?, category = ?, method = ?, description = ?, occurred_on = ?
       WHERE id = ? AND user_id = ?`,
      data.type, data.amount, data.category, data.method, data.description, data.occurredOn,
      id, user.id,
    );
    if (result.changes === 0) return fail("That entry no longer exists.");
  } else {
    run(
      `INSERT INTO transactions
         (user_id, type, amount_poisha, category, method, description, occurred_on, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      user.id, data.type, data.amount, data.category, data.method, data.description,
      data.occurredOn, Date.now(),
    );
  }

  refreshAll();
  return succeed(
    id
      ? "Entry updated."
      : `${data.type === "income" ? "Income" : "Expense"} of ${formatTaka(data.amount)} added to ${categoryLabel(data.category)}.`,
  );
}

export async function deleteTransaction(_prev, formData) {
  const user = await requireUser();
  const id = positiveInt(formData, "id");
  if (!id) return fail("That entry no longer exists.");

  const result = run("DELETE FROM transactions WHERE id = ? AND user_id = ?", id, user.id);
  if (result.changes === 0) return fail("That entry no longer exists.");

  refreshAll();
  return succeed("Entry deleted.");
}

/* ------------------------------------------------------------------ *
 * Budget limits                                                       *
 * ------------------------------------------------------------------ */

/** Creates the limit, or replaces it if the category already has one. */
export async function setBudgetLimit(_prev, formData) {
  const user = await requireUser();
  const errors = {};

  const category = text(formData, "category", 60);
  if (!category) errors.category = "Choose a category.";
  else if (!isValidCategory(category, "expense")) {
    errors.category = "Limits can only be set on expense categories.";
  }

  const limit = readAmount(formData, "limit", errors);
  if (hasErrors(errors)) return fail(INVALID, errors);

  run(
    `INSERT INTO budget_limits (user_id, category, limit_poisha, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, category) DO UPDATE SET
       limit_poisha = excluded.limit_poisha,
       updated_at   = excluded.updated_at`,
    user.id, category, limit, Date.now(),
  );

  refreshAll();
  return succeed(`${categoryLabel(category)} capped at ${formatTaka(limit)} a month.`);
}

export async function removeBudgetLimit(_prev, formData) {
  const user = await requireUser();
  const category = text(formData, "category", 60);

  const result = run(
    "DELETE FROM budget_limits WHERE user_id = ? AND category = ?",
    user.id,
    category,
  );
  if (result.changes === 0) return fail("That limit no longer exists.");

  refreshAll();
  return succeed(`Limit removed from ${categoryLabel(category)}.`);
}

/* ------------------------------------------------------------------ *
 * Goals                                                               *
 * ------------------------------------------------------------------ */

export async function createGoal(_prev, formData) {
  const user = await requireUser();
  const errors = {};

  const name = text(formData, "name", 100);
  if (!name) errors.name = "What are you saving for?";
  else if (name.length > 50) errors.name = "Keep it under 50 characters.";

  const target = readAmount(formData, "target", errors);

  const deadline = text(formData, "deadline", 10) || null;
  if (deadline && !isIsoDate(deadline)) errors.deadline = "Pick a valid date.";
  else if (deadline && deadline <= today()) errors.deadline = "Pick a date in the future.";

  if (hasErrors(errors)) return fail(INVALID, errors);

  run(
    `INSERT INTO goals (user_id, name, target_poisha, deadline, created_at) VALUES (?, ?, ?, ?, ?)`,
    user.id, name, target, deadline, Date.now(),
  );

  refreshAll();
  return succeed(`Goal "${name}" created. First deposit is the hardest.`);
}

/** `direction` is "in" (save) or "out" (withdraw); stored as a signed amount. */
export async function moveGoalMoney(_prev, formData) {
  const user = await requireUser();
  const errors = {};

  const goalId = positiveInt(formData, "goalId");
  const goal = goalId ? getGoal(user.id, goalId) : null;
  if (!goal) return fail("That goal no longer exists.");

  const direction = text(formData, "direction") === "out" ? "out" : "in";
  const amount = readAmount(formData, "amount", errors);
  if (amount && direction === "out" && amount > goal.savedPoisha) {
    errors.amount = `Only ${formatTaka(goal.savedPoisha)} is saved in this goal.`;
  }
  if (amount && direction === "in") {
    // Saving moves money you already have; it can't create it. Without this,
    // goals could hold more than the whole balance and "free" goes negative.
    const free = getSummary(user.id).balancePoisha - getSavedTotal(user.id);
    if (amount > free) {
      errors.amount =
        free > 0
          ? `You have ${formatTaka(free)} that isn't already in a goal. Log the income first if there's more.`
          : "Everything in your balance is already in goals. Log some income first.";
    }
  }
  if (hasErrors(errors)) return fail(INVALID, errors);

  run(
    `INSERT INTO goal_entries (goal_id, user_id, amount_poisha, occurred_on, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    goal.id, user.id, direction === "in" ? amount : -amount, today(), Date.now(),
  );

  refreshAll();
  const saved = goal.savedPoisha + (direction === "in" ? amount : -amount);
  return succeed(
    direction === "in"
      ? saved >= goal.targetPoisha
        ? `${goal.name} is fully funded. Go get it.`
        : `${formatTaka(amount)} saved towards ${goal.name}.`
      : `${formatTaka(amount)} taken out of ${goal.name}.`,
  );
}

export async function deleteGoal(_prev, formData) {
  const user = await requireUser();
  const id = positiveInt(formData, "id");
  const result = id ? run("DELETE FROM goals WHERE id = ? AND user_id = ?", id, user.id) : { changes: 0 };
  if (result.changes === 0) return fail("That goal no longer exists.");

  refreshAll();
  return succeed("Goal deleted.");
}

/* ------------------------------------------------------------------ *
 * Semesters                                                           *
 * ------------------------------------------------------------------ */

export async function createSemester(_prev, formData) {
  const user = await requireUser();
  const errors = {};

  const name = text(formData, "name", 100);
  if (!name) errors.name = "Give the semester a name.";
  else if (name.length > 60) errors.name = "Keep the name under 60 characters.";

  const startMonth = text(formData, "startMonth", 7);
  if (!isIsoMonth(startMonth)) errors.startMonth = "Pick a valid start month.";

  const months = Number(text(formData, "months", 3));
  if (!Number.isInteger(months) || months < 1 || months > 12) errors.months = "Between 1 and 12.";

  if (hasErrors(errors)) return fail(INVALID, errors);

  run(
    `INSERT INTO semesters (user_id, name, start_month, months, created_at) VALUES (?, ?, ?, ?, ?)`,
    user.id, name, startMonth, months, Date.now(),
  );

  refreshAll();
  return succeed(`${name} added. Its matrix builds itself from your ledger.`);
}

export async function deleteSemester(_prev, formData) {
  const user = await requireUser();
  const id = positiveInt(formData, "id");
  if (!id || !getSemester(user.id, id)) return fail("That semester no longer exists.");

  run("DELETE FROM semesters WHERE id = ? AND user_id = ?", id, user.id);

  refreshAll();
  return succeed("Semester deleted. Your transactions were not touched.");
}
