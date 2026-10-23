import { MoneyError, toPoisha } from "./utils.js";

/**
 * Plumbing shared by every server action. Each action returns a plain object
 * that `useActionState` renders — `{ status: 'success', message, at }` or
 * `{ status: 'error', message, fieldErrors, values }`.
 *
 * Lives outside the 'use server' files because those may only export async
 * functions; anything exported from them becomes a callable endpoint.
 */

/**
 * `values` echoes the submission back so a failed form keeps what was typed:
 * React 19 resets an uncontrolled form after its action runs, so the form
 * remounts on `at` and refills itself from these.
 */
export const fail = (message, fieldErrors, values) => ({
  status: "error",
  message,
  fieldErrors,
  values,
  at: Date.now(),
});

/**
 * `at` is a per-result token. Forms use it as a React `key`, so a successful
 * submit remounts the fields — clearing the inputs in one step instead of
 * resetting them piecemeal from inside an effect.
 */
export const succeed = (message, extra) => ({ status: "success", message, at: Date.now(), ...extra });

/** Trimmed string field, capped so a megabyte of "description" never reaches SQL. */
export const text = (formData, name, max = 500) =>
  String(formData.get(name) ?? "").trim().slice(0, max);

export const positiveInt = (formData, name) => {
  const n = Number(formData.get(name));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** Parses money, turning a MoneyError into a field error the student can read. */
export function readAmount(formData, name, errors) {
  try {
    return toPoisha(text(formData, name, 30));
  } catch (error) {
    errors[name] = error instanceof MoneyError ? error.message : "Invalid amount.";
    return null;
  }
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;

export const INVALID = "Please fix the highlighted fields.";

/** Deliberately loose: the only real test of an email is sending to it. */
export const isEmail = (value) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
