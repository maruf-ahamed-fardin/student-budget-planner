"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import {
  addTransaction,
  createSemester,
  deleteSemester,
  deleteTransaction,
  removeBudgetLimit,
  setBudgetLimit,
  setTheme,
} from "@/app/actions";
import { Button, Field, Icon } from "@/ui";
import {
  categoriesFor,
  currentMonth,
  cx,
  EXPENSE_CATEGORIES,
  formatMonth,
  IDLE,
  isActivePath,
  NAV_ITEMS,
} from "@/utils";

/**
 * Everything interactive in the app. Kept together so the boundary between
 * server-rendered markup and hydrated JavaScript is obvious at a glance: if it
 * isn't in this file (or charts.jsx), it never runs in the browser.
 */

/* ------------------------------------------------------------------ *
 * Shared form plumbing                                                *
 * ------------------------------------------------------------------ */

/**
 * Wires a server action to `useActionState` and surfaces the result as a toast.
 *
 * `resetKey` changes on every success, so a form can use it as a React `key` to
 * remount its fields — clearing inputs and local state in one step rather than
 * resetting them piecemeal from inside an effect.
 */
function useAction(action) {
  const [state, formAction] = useActionState(action, IDLE);

  // Only talks to an external system (the toast layer), which is what effects
  // are for. `useActionState` returns a fresh object per submit, so this fires
  // exactly once per result — including two identical failures in a row.
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    else if (state.status === "error") toast.error(state.message);
  }, [state]);

  return {
    formAction,
    errors: state.status === "error" ? (state.fieldErrors ?? {}) : {},
    resetKey: state.status === "success" ? state.at : "initial",
  };
}

/** Disables itself while the enclosing form's action is in flight. */
export function SubmitButton({ children, pendingLabel, ...props }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && (
        <span
          className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}

/* ------------------------------------------------------------------ *
 * Navigation                                                          *
 * ------------------------------------------------------------------ */

/** Desktop links. The gold pill on the active route comes from the mockup. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded px-3 py-1.5 text-[0.8125rem] transition-colors",
              active
                ? "bg-gold-500 font-semibold text-navy-950"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Phone navigation. Five items across a top bar is unusable at 375px, and the
 * top of the screen is out of thumb reach — which is exactly the posture a
 * student is in when logging a rickshaw fare. Hidden from md upward.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <nav aria-label="Primary" className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex flex-col items-center gap-0.5 py-2 text-[0.625rem] transition-colors",
                active ? "font-semibold text-accent" : "text-ink-muted",
              )}
            >
              <Icon name={item.icon} size={18} />
              {item.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * The server owns the theme (cookie → `data-theme` on <html> during SSR). The
 * toggle flips the attribute immediately so the change feels instant, then
 * persists it; without the local flip the page would sit on the old colours
 * until the server action round-trips.
 */
export function ThemeToggle({ theme }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(theme);
  const next = optimistic === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        startTransition(async () => {
          setOptimistic(next);
          await setTheme(next);
        });
      }}
      className="grid size-8 place-items-center rounded text-white/70 hover:bg-white/10 hover:text-white"
    >
      <Icon name={optimistic === "dark" ? "sun" : "moon"} size={17} />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Dashboard — quick add                                               *
 * ------------------------------------------------------------------ */

/**
 * A plain `<form action={…}>` over a server action, so it still submits and
 * still persists with JavaScript disabled. The hooks only add inline errors and
 * the toast on top.
 */
export function QuickAddForm({ today }) {
  const { formAction, errors, resetKey } = useAction(addTransaction);

  return (
    <form action={formAction} className="space-y-3 p-4">
      <QuickAddFields key={resetKey} today={today} errors={errors} />
    </form>
  );
}

function QuickAddFields({ today, errors }) {
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");

  return (
    <>
      {/* Two options deserve one tap, not a dropdown. */}
      <fieldset>
        <legend className="label">Type</legend>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-0.5">
          {["expense", "income"].map((option) => (
            <label
              key={option}
              className={cx(
                "flex cursor-pointer items-center justify-center gap-1 rounded py-1.5 text-[0.8125rem] font-medium capitalize transition-colors",
                type === option
                  ? option === "income"
                    ? "bg-surface text-income"
                    : "bg-surface text-expense"
                  : "text-ink-muted",
              )}
            >
              <input
                type="radio"
                name="type"
                value={option}
                checked={type === option}
                onChange={() => {
                  setType(option);
                  // The two lists are disjoint, so the old pick is no longer
                  // offered — clearing stops a stale value being submitted.
                  setCategory("");
                }}
                className="sr-only"
              />
              <Icon name={option === "income" ? "up" : "down"} size={14} />
              {option}
            </label>
          ))}
        </div>
        {errors.type && <p className="mt-1 text-xs text-expense">{errors.type}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <Field name="amount" label="Amount (৳)" error={errors.amount}>
          {(props) => (
            <input
              {...props}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="500"
              required
            />
          )}
        </Field>

        <Field name="occurredOn" label="Date" error={errors.occurredOn}>
          {(props) => (
            <input {...props} type="date" defaultValue={today} max={today} required />
          )}
        </Field>
      </div>

      <Field name="category" label="Category" error={errors.category}>
        {(props) => (
          <select
            {...props}
            required
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="" disabled>
              Choose a category…
            </option>
            {categoriesFor(type).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field name="description" label="Description (optional)" error={errors.description}>
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="e.g. Rickshaw to campus"
          />
        )}
      </Field>

      <SubmitButton className="w-full" pendingLabel="Adding…">
        <Icon name="plus" size={15} />
        Add Transaction
      </SubmitButton>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Transactions — filters and delete                                   *
 * ------------------------------------------------------------------ */

/**
 * Filters live in the URL, so the server component re-runs the query and the
 * filtered list is genuinely server-rendered — shareable, and correct with the
 * back button. This component only writes the query string.
 */
export function TransactionFilters({ months, initial }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(initial.search ?? "");

  function navigate(patch) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // Debounced: pushing a route on every keystroke would re-query the database
  // for every letter typed.
  useEffect(() => {
    if (search === (initial.search ?? "")) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search) next.set("q", search);
      else next.delete("q");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters = Boolean(
    initial.type || initial.category || initial.month || initial.search,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      <select
        aria-label="Filter by type"
        className="field w-auto min-w-28 flex-1 sm:flex-none"
        value={initial.type ?? ""}
        onChange={(event) => navigate({ type: event.target.value })}
      >
        <option value="">All types</option>
        <option value="income">Income</option>
        <option value="expense">Expense</option>
      </select>

      <select
        aria-label="Filter by month"
        className="field w-auto min-w-32 flex-1 sm:flex-none"
        value={initial.month ?? ""}
        onChange={(event) => navigate({ month: event.target.value })}
      >
        <option value="">All months</option>
        {months.map((month) => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
      </select>

      <div className="relative min-w-40 flex-1">
        <Icon
          name="search"
          size={15}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          aria-label="Search descriptions"
          placeholder="Search…"
          className="field pl-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            router.replace(pathname, { scroll: false });
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

/** Delete with a confirm step, so one stray tap can't wipe an entry. */
export function DeleteButton({ id, label, action = deleteTransaction }) {
  const { formAction } = useAction(action);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm(`Delete ${label}? This cannot be undone.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteSubmit label={label} />
    </form>
  );
}

function DeleteSubmit({ label }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={`Delete ${label}`}
      aria-label={`Delete ${label}`}
      className="grid size-7 place-items-center rounded text-ink-muted transition-colors hover:bg-expense-wash hover:text-expense disabled:opacity-40"
    >
      <Icon name="trash" size={15} />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Budget                                                              *
 * ------------------------------------------------------------------ */

export function BudgetLimitForm() {
  const { formAction, errors, resetKey } = useAction(setBudgetLimit);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 p-4">
      <BudgetLimitFields key={resetKey} errors={errors} />
    </form>
  );
}

function BudgetLimitFields({ errors }) {
  return (
    <>
      <Field
        name="category"
        label="Category"
        error={errors.category}
        className="min-w-40 flex-1"
      >
        {(props) => (
          <select {...props} required defaultValue="">
            <option value="" disabled>
              Choose a category…
            </option>
            {EXPENSE_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        name="limit"
        label="Monthly limit (৳)"
        error={errors.limit}
        className="min-w-32 flex-1"
      >
        {(props) => (
          <input
            {...props}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="2000"
            required
          />
        )}
      </Field>

      <SubmitButton pendingLabel="Saving…">Set limit</SubmitButton>
    </>
  );
}

/** Removes a category limit; the transactions in it are untouched. */
export function RemoveLimitButton({ category, label }) {
  const { formAction } = useAction(removeBudgetLimit);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm(`Remove the limit on ${label}?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="category" value={category} />
      <DeleteSubmit label={`the ${label} limit`} />
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Charts + semester pickers                                           *
 * ------------------------------------------------------------------ */

/** A select that navigates — used for the chart month and the semester. */
export function QueryPicker({ name, label, value, options }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <select
      aria-label={label}
      className="field w-auto"
      value={value}
      onChange={(event) => {
        const next = new URLSearchParams(params);
        next.set(name, event.target.value);
        router.replace(`${pathname}?${next}`, { scroll: false });
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ *
 * Semester                                                            *
 * ------------------------------------------------------------------ */

export function SemesterForm() {
  const { formAction, errors, resetKey } = useAction(createSemester);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 p-4">
      <SemesterFields key={resetKey} errors={errors} />
    </form>
  );
}

function SemesterFields({ errors }) {
  return (
    <>
      <Field name="name" label="Semester name" error={errors.name} className="min-w-40 flex-1">
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={60}
            placeholder="e.g. Spring 2026"
            required
          />
        )}
      </Field>

      <Field
        name="startMonth"
        label="Starts"
        error={errors.startMonth}
        className="min-w-32 flex-1"
      >
        {(props) => (
          <input {...props} type="month" defaultValue={currentMonth()} required />
        )}
      </Field>

      <Field name="months" label="Months" error={errors.months} className="w-24">
        {(props) => (
          <input {...props} type="number" min={1} max={12} defaultValue={6} required />
        )}
      </Field>

      <SubmitButton pendingLabel="Adding…">Add semester</SubmitButton>
    </>
  );
}

export function DeleteSemesterButton({ id, name }) {
  const { formAction } = useAction(deleteSemester);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm(`Delete ${name}? Your transactions are not affected.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteSubmit label={name} />
    </form>
  );
}
